MODEL_VERSION = 1

RAW_GDT_DATA = 'data/raw/gdt/'
RAW_FONTERRA_DATA = 'data/raw/fonterra/'
PROCESSED_DATA = 'data/processed/'
MODELS = 'data/models/'

import datetime
import io
import json
import numpy
import os
import pandas
import requests
import statsmodels.api
import sys
import traceback

def gdt_events_to_json():
    data = pandas.read_csv(PROCESSED_DATA + 'gdt_events.csv')
    with open('docs/gdt_events.json', 'w') as io:
        output = {}
        for key in ['date', 'amf', 'bmp', 'but', 'smp', 'wmp']:
            output[key] = data[key].tolist()
        json.dump(output, io, indent=2)

# To rebuild the GDT dataset, run this script:
def force_rebuild_gdt():
    response = requests.get('https://s3.amazonaws.com/' + \
        'www-production.globaldairytrade.info/results/' + \
        '055763cd-d9c3-4814-915c-23ed48abbaf3/price_indices_ten_years.json')
    data = response.json()
    data['PriceIndicesTenYears']['Events']['EventDetails'][0]
    events = []
    for event in data['PriceIndicesTenYears']['Events']['EventDetails']:
        events.append({
            'number': event['EventNumber'],
            'date': event['EventDate'],
            'guid': event['EventGUID']
        })
        try:
            get_results(event['EventGUID'])
        except:
            # Some events are not available through the JSON API.
            print(event['EventNumber'])

def get_gdt_json(filename):
    url = 'https://s3.amazonaws.com/www-production.globaldairytrade.info/results/'
    return requests.get(url + filename).json()
# Return the UUID for the latest trading event.
def get_latest_key():
    response = get_gdt_json('latest.json')
    return response['latestEvent']

def get_product_group_result(key):
    return get_gdt_json(key + '/product_groups_summary.json')

def get_event_summary(key):
    return get_gdt_json(key + '/event_summary.json')

def get_results(key):
    filename = RAW_GDT_DATA + key + '.json'
    if not (os.path.exists(filename) and os.path.isfile(filename)):
        data = get_product_group_result(key)
        data['event_summary'] = get_event_summary(key)
        data['key'] = key
        with open(filename, 'w') as io:
            json.dump(data, io)
        return data
    return

def get_latest_results():
    key = get_latest_key()
    return get_results(key)

def rebuild_processed_gdt_events():
    old_df = pandas.read_csv(RAW_GDT_DATA + 'events.csv')
    old_df.sort_values('trading_event')
    event_results = []
    for filename in os.listdir(RAW_GDT_DATA):
        if filename[-5:] == ".json":
            if filename == 'nzx_settlements.json':
                continue
            with open(RAW_GDT_DATA + filename, 'r') as io:
                data = json.load(io)
                date = datetime.datetime.strptime(
                    data['event_summary']['EventSummary']['EventDate'],
                    '%B %d, %Y %H:%M:%S')
                event = {
                    'trading_event': int(float(data['event_summary']['EventSummary']['EventNumber'])),
                    'date': date.strftime('%Y-%m-%d')
                }
                for res in data['ProductGroups']['ProductGroupResult']:
                    # Annoyingly, GDT changed from the winning price to a
                    # published price at some point.
                    if 'AverageWinningPrice' in res:
                        event[res['ProductGroupCode']] = res['AverageWinningPrice']
                    else:
                        event[res['ProductGroupCode']] = res['AveragePublishedPrice']
                event_results.append(event)
    event_results.sort(key= lambda x: x['trading_event'])
    with open(PROCESSED_DATA + 'gdt_events.csv', 'w') as io:
        io.write('trading_event,date,amf,bmp,but,smp,wmp\n')
        first_new_event = event_results[0]['trading_event']
        # Rely on historical dataset for early trading events.
        for row in old_df.iterrows():
            if row[1]['trading_event'] >= first_new_event:
                break
            else:
                date = datetime.datetime.strptime(row[1]['date'], '%d/%m/%Y')
                io.write(str(row[1]['trading_event']) + ',' + date.strftime('%Y-%m-%d'))
                for key in ['amf', 'bmp', 'but', 'smp', 'wmp']:
                    value = row[1][key]
                    if pandas.isnull(value):
                        io.write(',')
                    else:
                        io.write(',' + str(round(value)))
                io.write('\n')
        # Use JSON data for newer trading events.
        for event in event_results:
            io.write(str(event['trading_event']) + ',' + event['date'])
            for key in ['AMF', 'BMP', 'Butter', 'SMP', 'WMP']:
                io.write(',' + event[key])
            io.write('\n')
    return

def impute_missing_gdt_events():
    gdt_events = pandas.read_csv(PROCESSED_DATA + 'gdt_events.csv')
    # First imputation pass: if we are just missing a value for one week,
    # average the values of the week before and the week after.
    for key in ['amf', 'bmp', 'but', 'smp', 'wmp']:
        for row in range(1, len(gdt_events['trading_event']) - 1):
            if pandas.isnull(gdt_events[key][row]):
                if not (pandas.isnull(gdt_events[key][row-1]) or pandas.isnull(gdt_events[key][row+1])):
                    gdt_events.loc[row, key] = 0.5 * (gdt_events[key][row-1] + gdt_events[key][row+1])

    # Second imputation pass: impute bmp based on a linear regression of amf,
    # smp, and wmp; then impute but based on a linear regression of amf, smp,
    # and wmp.
    training_df = gdt_events.dropna()
    features = pandas.DataFrame(training_df, columns=['amf', 'smp', 'wmp'])
    for imputation_key in ['bmp', 'but']:
        target = pandas.DataFrame(training_df, columns=[imputation_key])
        model = statsmodels.api.OLS(target, features).fit()
        for row in range(gdt_events.shape[0]):
            if pandas.isnull(gdt_events.loc[row, imputation_key]):
                row_df = gdt_events.loc[[row], ['amf', 'smp', 'wmp']]
                gdt_events.loc[row, imputation_key] = float(model.predict(row_df))
    # Round all values to closest dollar amount for simplicity.
    for key in ['amf', 'bmp', 'but', 'smp', 'wmp']:
        gdt_events[key] = [round(value) for value in gdt_events[key]]
    gdt_events.sort_values('trading_event')
    gdt_events.to_csv(PROCESSED_DATA + 'gdt_events.csv', index=False)

def calculate_average_sales_curve():
    sales = pandas.read_csv(RAW_FONTERRA_DATA + 'monthly_sales_contracts.csv')
    for col in range(1, sales.shape[1]):
        for row in range(sales.shape[0]):
            sales.iloc[row, col] /= sales.iloc[-1, col]
    cumulative_sales_curve = [numpy.mean(sales.iloc[row, 1:]) for row in range(sales.shape[0])]
    sales_curve = [cumulative_sales_curve[0]]
    for i in range(1, len(cumulative_sales_curve)):
        sales_curve.append(cumulative_sales_curve[i] - cumulative_sales_curve[i-1])
    with open(PROCESSED_DATA + 'monthly_sales_curve.json', 'w') as io:
        json.dump([sales_curve[i] / 2 for i in range(len(sales_curve)) for j in range(2)], io)

def get_average_sales_curve():
    with open(PROCESSED_DATA + 'monthly_sales_curve.json', 'r') as io:
        return json.load(io)

def calculate_average_product_mix():
    production = pandas.read_csv(RAW_FONTERRA_DATA + 'quarterly_production.csv')
    for key in ['WMP', 'SMP', 'BUT', 'AMF', 'BMP']:
        for row in range(production.shape[0]):
            production.loc[row, key] /= production.loc[row, 'Supply']
    months = ['jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar', 'apr', 'may']
    quarterly_production = pandas.DataFrame(data = {'quarter': [1,2,3,4]})
    for key in ['WMP', 'SMP', 'BUT', 'AMF', 'BMP']:
        quarterly_production[key] = [
            numpy.mean(production[production['Period'] == quarter][key])
            for quarter in range(1, 5)]
    quarterly_production[['AMF', 'BMP', 'BUT', 'SMP', 'WMP']].to_csv(
        PROCESSED_DATA + 'product_mix.csv', index=False)

def get_product_mix():
    product_mix = pandas.read_csv(PROCESSED_DATA + 'product_mix.csv').values
    product_mix = [product_mix[i] for i in range(4) for j in range(6)]
    for i in range(4):
        product_mix.append(product_mix[0])
    return product_mix

def to_log(data):
    log_data = data[['amf', 'bmp', 'but', 'smp', 'wmp']]
    for key in ['amf', 'bmp', 'but', 'smp', 'wmp']:
        log_data.loc[:, key] = numpy.log(log_data[key])
    return log_data

def construct_gdt_model():
    data = pandas.read_csv(PROCESSED_DATA + 'gdt_events.csv')
    data.loc[:, 'date'] = pandas.to_datetime(data['date'], format='%Y-%m-%d')
    data.sort_values('date')
    log_data = to_log(data[['amf', 'bmp', 'but', 'smp', 'wmp']])
    model = statsmodels.tsa.api.VAR(log_data)
    data = data.set_index('date')
    return model.fit(2), data

def simulate_var(model, data, num_steps):
    # We use a mean-reverting, log AR(2) model. The white noise term is sampled
    # from the empirical distribution of residuals. In other words:
    # x(t) = exp(A * log(x(t-1)) + B * log(x(t-2)) + c + noise)
    B = model.params.values[6:11]
    A = model.params.values[1:6]
    c = model.params.values[0]
    noise = model.resid.values
    output = data.copy()
    for step in range(num_steps):
        noise_index = numpy.random.choice(range(len(model.resid.values)))
        # Todo: is there a more efficient way than vstack? We really just want a
        # vector of vectors, rather than an ndarray.
        output = numpy.vstack(
            (output, numpy.exp(
                # x'A rather than Ax because the model.params array is the wrong
                # transpose.
                numpy.matmul(numpy.log(output[-1]), A) +
                numpy.matmul(numpy.log(output[-2]), B) +
                c +
                noise[noise_index])
            )
        )
    return output

def simulate_gdt(model, data, sales_curve, product_mix):
    steps_remaining = 28 - data.shape[0]
    forecast_data = simulate_var(model, data, steps_remaining)
    gdt_value = 0.0
    auctions = []
    for trading_event in range(2, 28):
        auction_value = numpy.dot(product_mix[trading_event - 2], forecast_data[trading_event])
        auctions.append(auction_value)
        gdt_value += sales_curve[trading_event - 2] * auction_value
    return gdt_value / 1000, auctions

def load_config():
    with open('docs/config.json', 'r') as io:
            return json.load(io)

def simulate_model(run_date):
    config = load_config()
    start_date = config["start_date"]
    estimates = config["estimates"][0]
    fx_min = estimates["fx_min"]
    fx_max = estimates["fx_max"]
    cost_min = estimates["cost_min"]
    cost_max = estimates["cost_max"]
    default_prior = estimates["default_prior"]
    default_prior_weight = estimates["default_prior_weight"]

    print('... constructing model ...')
    model, data = construct_gdt_model()
    print('... beginning Monte Carlo ...')
    data = data.drop(['trading_event'], 1)
    input_data = data[(start_date <= data.index) & (data.index <= run_date)].values
    sales_curve = get_average_sales_curve()
    product_mix = get_product_mix()

    number_simulations = config["num_simulations"]
    nzd_earnings = []
    usd_simulations = []
    fx_simulations = []
    cost_simulations = []
    auctions = []
    for simulation in range(number_simulations):
        usd_revenue, auction = simulate_gdt(model, input_data, sales_curve, product_mix)
        auctions.append(auction)
        usd_simulations.append(usd_revenue)
        FX = numpy.random.uniform(fx_min, fx_max)
        fx_simulations.append(FX)
        cost = numpy.random.uniform(cost_min, cost_max)
        cost_simulations.append(cost)
        nzd_earnings.append(usd_revenue / FX - cost)
    # Normalize the nzd_earnings by shifing the mean to the weighted default
    # prior.
    nzd_mean = numpy.mean(nzd_earnings)
    print(nzd_mean)
    new_mean = default_prior_weight * default_prior + \
        (1 - default_prior_weight) * nzd_mean
    print(new_mean)
    for (i, nzd) in enumerate(nzd_earnings):
        nzd_earnings[i] += (new_mean - nzd_mean)
    print('... finished Monte Carlo ...')
    print('... writing data ...')
    with open(MODELS + run_date + '.json', 'w') as io:
        json.dump({
            'usd_simulations': usd_simulations,
            'fx_simulations': fx_simulations,
            'cost_simulations': cost_simulations,
            'nzd_earnings': nzd_earnings
        }, io)
    with open('docs/forecasts.json', 'r') as io:
        json_str = io.read()
        forecasts = json.loads(json_str[json_str.find('['):])
        forecasts.append({
            'date': run_date,
            'model_version': MODEL_VERSION,
            '10%': round(numpy.percentile(nzd_earnings, 10), 2),
            '20%': round(numpy.percentile(nzd_earnings, 20), 2),
            '30%': round(numpy.percentile(nzd_earnings, 30), 2),
            '40%': round(numpy.percentile(nzd_earnings, 40), 2),
            '50%': round(numpy.percentile(nzd_earnings, 50), 2),
            '60%': round(numpy.percentile(nzd_earnings, 60), 2),
            '70%': round(numpy.percentile(nzd_earnings, 70), 2),
            '80%': round(numpy.percentile(nzd_earnings, 80), 2),
            '90%': round(numpy.percentile(nzd_earnings, 90), 2)
        })
    with open('docs/forecasts.json', 'w') as io:
        json.dump(forecasts, io, indent=2)
    return

def get_last_error():
    body = 'Error during run. Please see the error below: ' + '\n'
    with io.StringIO() as string_buffer:
        traceback.print_last(file=string_buffer)
        body += string_buffer.getvalue()
    return body

def update_forecast():
    get_latest_results()
    print('... rebuilding events.csv ...')
    rebuild_processed_gdt_events()
    print('... imputing missing data ...')
    impute_missing_gdt_events()
    print('... writing to file ...')
    gdt_events_to_json()
    print('... calculating sales curve ...')
    calculate_average_sales_curve()
    print('... calculating product mix ...')
    calculate_average_product_mix()
    print('Beginning simulation')
    todays_date = datetime.datetime.now().strftime('%Y-%m-%d')
    simulate_model(todays_date)
    print('Finished simulation.')

if __name__ == "__main__":
    todays_date = datetime.datetime.now().strftime('%Y-%m-%d')
    print('Kicking off automatic updater: %s' % todays_date)
    force = False
    if len(sys.argv) > 1:
        if "--rebuild_gdt" in sys.argv:
            force_rebuild_gdt()
        if "--force" in sys.argv:
            force = True
    try:
        print('Updating dataset')
        if (get_latest_results() != None) or force:
            update_forecast()
        else:
            print('Nothing to be done.')
    except:
        print(get_last_error())
    print('-------------------------------------------------------------------')
