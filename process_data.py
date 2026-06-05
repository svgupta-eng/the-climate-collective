import pandas as pd
import xarray as xr
import gcsfs

target_lat = 32.88
target_lon = 360 - 117.23

def fetch_temp_data(df_catalog, experiment):
    subset = df_catalog[
        (df_catalog['variable_id'] == 'tasmax') & 
        (df_catalog['table_id'] == 'day') &       
        (df_catalog['source_id'] == 'MIROC6') &
        (df_catalog['experiment_id'] == experiment)
    ]
    
    zstore_url = subset['zstore'].values[0]
    print(f"Fetching {experiment} from: {zstore_url}")
    
    fs = gcsfs.GCSFileSystem(token='anon')
    mapper = fs.get_mapper(zstore_url)
    
    try:
        ds = xr.open_zarr(mapper, consolidated=True)
    except KeyError:
        ds = xr.open_zarr(mapper, consolidated=False)
        
    local_data = ds['tasmax'].sel(lat=target_lat, lon=target_lon, method='nearest')
    
    df = local_data.to_dataframe().reset_index()
    df['year'] = df['time'].apply(lambda x: x.year)
    
    df['tasmax_f'] = (df['tasmax'] - 273.15) * 9/5 + 32
    
    df['is_extreme'] = df['tasmax_f'] > 90
    
    extreme_counts = df.groupby('year')['is_extreme'].sum().reset_index()
    extreme_counts.rename(columns={'is_extreme': 'extreme_days'}, inplace=True)
    extreme_counts['experiment'] = experiment
    
    return extreme_counts[['year', 'extreme_days', 'experiment']]

def main():
    catalog = pd.read_csv('data/cmip6-zarr-consolidated-stores-noQC.csv')
    
    try:
        hist_df = fetch_temp_data(catalog, 'historical')
        fut_df = fetch_temp_data(catalog, 'ssp585')
        
        combined = pd.concat([hist_df, fut_df])
        combined = combined[((combined['experiment'] == 'historical') & (combined['year'] <= 2014)) | 
                            ((combined['experiment'] == 'ssp585') & (combined['year'] > 2014))]
                            
        combined.to_json('data/ucsd_temperature.json', orient='records')
        print("Success! Saved data to data/ucsd_temperature.json")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()