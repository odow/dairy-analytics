import datetime, dateutil, json, os, re, requests
import pandas
from bs4 import BeautifulSoup

import utils

def get_raw_agrihq():
    """
    Gets the latest json file from the AgriHQ farmgate milk price calculator.

    Stores the result in /data/raw/agrihq.
    """
    utils.__require_environment_variable__('agrihq_client_key')
    response = requests.get('https://dairy-tools.nzx.com/fgmp/calculator_widget.json',
                            data={'client_key': os.environ['agrihq_client_key']})
    calculations = response.json()['calculations']
    effective_date = dateutil.parser.parse(calculations[0]['effective_at']).strftime('%Y-%m-%d')
    filename = utils.data_dir('agrihq/' + effective_date + '.json')
    if os.path.isfile(filename):
        print('AgriHQ, file already exists for date: ' + effective_date)
    else:
        utils.json_dump(filename, calculations, indent = 2)

def get_raw_westpac():
    """
    Download all missing Fortnightly Agri Updates.

    Stores the result in /data/raw/westpac.
    """
    FAU_REGEX = re.compile('.+?Fortnightly-Agri-Update-(\d+)-(\S+)-(\d+)')
    WESTPAC_URL = 'https://www.westpac.co.nz/agribusiness/agri-information/' + \
                  'fortnightly-agri-updates/'
    response = requests.get(WESTPAC_URL)
    soup = BeautifulSoup(response.text, 'html.parser')
    new_files = []
    for link in soup.find_all('a'):
        link_url = link.get('href')
        if link_url == None:
            continue
        match = FAU_REGEX.match(link_url)
        if match != None:
            date = match[3]+ '-' + match[2] + '-' + match[1]
            output_file = utils.data_dir('westpac/' + date + '.pdf')
            if not os.path.isfile(output_file):
                response = requests.get('https://www.westpac.co.nz/' + link_url)
                new_files.append(date)
                with open(output_file, 'wb') as file:
                    file.write(response.content)
    return new_files

def get_nzx_trading_event(data, trading_event):
    """
    Add trading event data to `data`. Returns true if new data found.
    """
    if trading_event in data:
        return False
    previous_trading_event = str(int(trading_event) - 1)
    response = requests.get('https://www.nzx.com/markets/nzx-dairy-derivatives/'
                            'global-dairy-trade/' + trading_event + '/gdt_price_report')
    if 'Something went wrong.' in response.text:
        return False
    data[trading_event] = {}
    soup = BeautifulSoup(response.text, 'html.parser')
    winning = soup.find_all('table')[0]
    products = ['wmp', 'smp', 'amf','but']
    for i, row in enumerate(winning.find_all('tr')):
        if i >= 3:
            cells = [cell.text.strip() for cell in row.find_all('td')]
            product = products[i - 3]
            data[trading_event][product] = cells[0].replace(',','')
            if previous_trading_event in data:
                if data[previous_trading_event][product] != cells[1].replace(',',''):
                    raise(Exception('Error. Inconsistent data.'))
    return True

def get_gdt_settlement_prices():
    """
    Stores the result in /data/raw/gdt/nzx_settlements.json.
    """
    filename = utils.data_dir('gdt/nzx_settlements.json')
    data = utils.json_load(filename)
    next_te = max([int(key) for key in data]) + 1
    print('Running NZX scraper. Trading Event: ' + str(next_te))
    get_nzx_trading_event(data, str(next_te))
    for te in data:
        for prod in data[te]:
            if data[te][prod] != '-':
                data[te][prod] = int(data[te][prod])
    utils.json_dump(filename, data)

def get_nzx_daily_settlements():
    response = requests.get('https://www.nzx.com/markets/nzx-dairy-derivatives/market-information')
    soup = BeautifulSoup(response.text, 'html.parser')
    for link in soup.find_all('a'):
        if link.text == 'Final':
            url = link.get('href')
            filename = utils.data_dir('nzx/' + url.split('/')[-1])
            if not os.path.isfile(filename):
                with open(filename, 'w') as file:
                    csv_response = requests.get(url)
                    file.write(csv_response.text)
    # full_dataframe = pandas.read_csv('../data/nzx/daily_settlement_prices.csv')
    # for filename in os.listdir('../data/nzx/raw'):
    #     dataframe = pandas.read_csv('../data/nzx/raw/' + filename)
    #     dataframe = dataframe.rename(columns = {'Code': 'code',
    #                                             'Trade date': 'date',
    #                                             'Calculated DSP': 'price'})
    #     full_dataframe = full_dataframe.append(dataframe[['code', 'date', 'price']],
    #                        sort = False)
    # full_dataframe.drop_duplicates(inplace=True)
    # full_dataframe.to_csv('../data/nzx/daily_settlement_prices.csv')

def run_scraper():
    try:
        new_files = get_raw_westpac()
        if len(new_files) > 0:
            send_email(subject = 'New Westpac files found',
                       body = new_files.join(', '))
    except:
        utils.send_email_of_last_error('westpac scraper')

    try:
        get_raw_agrihq()
    except:
        utils.send_email_of_last_error('agrihq scraper')

    try:
        get_gdt_settlement_prices()
    except:
        utils.send_email_of_last_error('nzx settlement scraper')

    try:
        get_nzx_daily_settlements()
    except:
        utils.send_email_of_last_error('nzx scraper')

if __name__ == '__main__':
    run_scraper()
