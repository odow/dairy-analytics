import pandas, json, os
import utils

def calculate_agrihq_estimate(estimate):
    products = ['wmp', 'smp', 'amf', 'but', 'bmp']
    usd_earnings = 0.0
    for product in products:
        coefficient = 1 / estimate['m' + product]
        price = estimate['p' + product] / 1000
        weight = estimate['r' + product]
        usd_earnings += coefficient * price
    nzd_earnings = usd_earnings / estimate['eact']
    nzd_earnings -= estimate['clac']
    nzd_earnings -= estimate['ccac']
    return nzd_earnings * estimate['rwmp']

def process_raw_agrihq_data():
    historical = utils.data_dir('agrihq/historical.csv', dir='raw')
    agrihq_forecasts = {}
    for row in pandas.read_csv(historical).iterrows():
        date, season, forecast = row[1]
        if season not in agrihq_forecasts:
            agrihq_forecasts[season] = []
        agrihq_forecasts[season].append({'date': date,
                                         'forecast': round(forecast, 2)})

    directory = utils.data_dir('agrihq', dir='raw')
    forecasts = {}
    season = '2018'
    if season not in agrihq_forecasts:
        agrihq_forecasts[season] = []

    for file in os.listdir(directory):
        if '.json' in file:
            data = utils.json_load(os.path.join(directory, file))
            estimate = calculate_agrihq_estimate(data[0])
            forecast = calculate_agrihq_estimate(data[1])
            agrihq_forecasts[season].append({'date': file.split('.')[0],
                                             'forecast': round(estimate + forecast, 2)})
    utils.json_dump(utils.data_dir('agrihq.json', dir='processed'), agrihq_forecasts)
    return agrihq_forecasts

if __name__ == '__main__':
    process_raw_agrihq_data()
