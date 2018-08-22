import requests, json, os, datetime, dateutil
from bs4 import BeautifulSoup

import io, traceback
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

def json_dump(filename, data, indent=0):
    with open(filename, 'w') as file:
        json.dump(data, file, indent=indent)

def json_load(filename):
    with open(filename, 'r') as file:
        return json.load(file)

def __require_environment_variable__(key):
    if key not in os.environ:
        raise(Exception('You must set the environment variable: ' + key))

def send_email(subject='',
               body='',
               recipients = ['o.dowson@gmail.com']):
    __require_environment_variable__('emailer_secret')
    sender = 'dairyanalytics.emailer@gmail.com'
    message = MIMEMultipart()
    message['From'] = sender
    message['To'] = ','.join(recipients)
    message['Subject'] = subject
    message.attach(MIMEText(body, 'html'))
    server = smtplib.SMTP('smtp.gmail.com', 587)
    server.starttls()
    server.login(sender, os.environ['emailer_secret'])
    server.send_message(message)
    server.quit()

"""
    send_email_of_last_error(location='')

Send an email to the default recipients with the error of why the scraper
crashed.
"""
def send_email_of_last_error(location=''):
    body = 'Error in ' + location + '. Please see the error below: ' + '\n'
    with io.StringIO() as string_buffer:
        traceback.print_last(file=string_buffer)
        body += string_buffer.getvalue()
    send_email(subject = 'Error: dairyanalytics.co.nz',
               body = body)
    raise(Exception(body))

def get_westpac_pdfs():
    """
    Download all missing Fortnightly Agri Updates
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
            output_file = '../data/forecasts/westpac/' + date + '.pdf'
            if not os.path.isfile(output_file):
                response = requests.get('https://www.westpac.co.nz/' + link_url)
                new_files.append(date)
                with open(output_file, 'wb') as file:
                    file.write(response.content)
    return new_files

def run_agri_hq_scraper():
    """
    Gets the latest json file from the AgriHQ farmgate milk price calculator.
    """
    __require_environment_variable__('agrihq_client_key')
    response = requests.get('https://dairy-tools.nzx.com/fgmp/calculator_widget.json',
                            data={'client_key': os.environ['agrihq_client_key']})
    calculations = response.json()['calculations']
    effective_date = dateutil.parser.parse(calculations[0]['effective_at']).strftime('%Y-%m-%d')
    filename = '../data/forecasts/agrihq/' + effective_date + '.json'
    if os.path.isfile(filename):
        print('AgriHQ, file already exists for date: ' + effective_date)
    else:
        json_dump(filename, calculations, indent = 2)

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

def run_nzx_scraper():
    with open('../data/gdt/nzx_settlements.json', 'r') as file:
        data = json.load(file)
    next_te = max([int(key) for key in data]) + 1
    print('Running NZX scraper. Trading Event: ' + str(next_te))
    get_nzx_trading_event(data, str(next_te))
    for te in data:
        for prod in data[te]:
            if data[te][prod] != '-':
                data[te][prod] = int(data[te][prod])

def run_daily_scraper():
    try:
        new_files = run_westpac_scraper()
        if len(new_files) > 0:
            send_email(subject = 'New Westpac files found',
                       body = new_files.join(', '))
    except:
        send_email_of_last_error('westpac scraper')

    try:
        run_agri_hq_scraper()
    except:
        send_email_of_last_error('agrihq scraper')

    try:
        run_nzx_scraper()
    except:
        send_email_of_last_error('nzx scraper')
