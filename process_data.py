import pandas as pd
import xarray as xr
import gcsfs

experiments = ['historical', 'ssp585']

def load_cities():
    cities = pd.read_csv('data/worldcities.csv')
    cities = cities[cities['capital'] == 'primary']
    cities = cities.rename(columns={'lng':'lon'})
    cities['lat'] = pd.to_numeric(cities['lat'], errors='coerce')
    cities['lon'] = pd.to_numeric(cities['lon'], errors='coerce')
    cities = cities.dropna(subset=['lat', 'lon'])
    cities['cmip6_lon'] = cities['lon'].apply(lambda x: x if x >= 0 else 360 + x)
    return cities.to_dict('records')

def fetch_temp_data(df_catalog, experiment, city_info):
    subset = df_catalog[
        (df_catalog['variable_id'] == 'tasmax') & 
        (df_catalog['table_id'] == 'day') &       
        (df_catalog['source_id'] == 'MIROC6') &
        (df_catalog['experiment_id'] == experiment)
    ]

    if subset.empty:
        raise ValueError(f"No CMIP6 data found for experiment: {experiment}")
    
    zstore_url = subset['zstore'].values[0]
    print(f"Fetching {experiment} from: {zstore_url}")
    
    fs = gcsfs.GCSFileSystem(token='anon')
    mapper = fs.get_mapper(zstore_url)
    
    try:
        ds = xr.open_zarr(mapper, consolidated=True)
    except KeyError:
        ds = xr.open_zarr(mapper, consolidated=False)
        
    local_data = ds['tasmax'].sel(
        lat=city_info['lat'], 
        lon=city_info['cmip6_lon'],
        method='nearest'
        )
    
    df = local_data.to_dataframe().reset_index()
    df['year'] = df['time'].apply(lambda x: x.year)
    
    df['tasmax_f'] = (df['tasmax'] - 273.15) * 9/5 + 32
    
    df['is_extreme'] = df['tasmax_f'] > 90
    
    extreme_counts = df.groupby('year')['is_extreme'].sum().reset_index()
    extreme_counts.rename(columns={'is_extreme': 'extreme_days'}, inplace=True)
    extreme_counts['experiment'] = experiment
    extreme_counts['city'] = city_info['city']
    extreme_counts['country'] = city_info['country']
    extreme_counts['lat'] = city_info['lat']
    extreme_counts['lon'] = city_info['lon']
    
    return extreme_counts[['city', 'country', 'lat', 'lon', 'year', 'extreme_days', 'experiment']]

def main():
    catalog = pd.read_csv('data/cmip6-zarr-consolidated-stores-noQC.csv')
    cities = load_cities()

    print(f"Processing data for {len(cities)} cities...")

    all_data = []

    for city in cities:
        for experiment in experiments:
            try:
                df = fetch_temp_data(catalog, experiment, city)
                all_data.append(df)
                print(f"Saved data for {city['city']} - {experiment}")
            except Exception as e:
                print(f"Error processing {city['city']} - {experiment}: {e}")

    combined = pd.concat(all_data, ignore_index=True)
    combined = combined[
        ((combined['experiment'] == 'historical') & (combined['year'] <= 2014)) | 
        ((combined['experiment'] == 'ssp585') & (combined['year'] > 2014))
    ]

    combined.to_json('data/extreme_heat_days.json', orient='records')
    combined.to_csv('data/extreme_heat_days.csv', index=False)

    print("Data processing complete. Files saved: 'data/extreme_heat_days.json' and 'data/extreme_heat_days.csv'.")

if __name__ == "__main__":
    main()