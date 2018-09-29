import datetime, dateutil, json, os, re, requests

def get_raw_agrihq():
    """
    Gets the latest json file from the AgriHQ farmgate milk price calculator.

    Stores the result in /data/raw/agrihq.
    """
    key = 'agrihq_client_key'
    if key not in os.environ:
        raise(Exception('You must set the environment variable: ' + key))
    response = requests.get(
        'https://dairy-tools.nzx.com/fgmp/calculator_widget.json',
        data={'client_key': os.environ['agrihq_client_key']})
    calculations = response.json()['calculations']
    effective_date = dateutil.parser.parse(
        calculations[0]['effective_at']).strftime('%Y-%m-%d')
    filename = 'data/agrihq/' + effective_date + '.json'
    if os.path.isfile(filename):
        return False
    else:
        with open(filename, 'w') as file:
            json.dump(calculations, file, indent=2)
    return True

def get_last_error():
    body = 'Error during run. Please see the error below: ' + '\n'
    with io.StringIO() as string_buffer:
        traceback.print_last(file=string_buffer)
        body += string_buffer.getvalue()
    return body

if __name__ == "__main__":
    todays_date = datetime.datetime.now().strftime('%Y-%m-%d')
    print('Kicking off data scraper: %s' % todays_date)
    try:
        if get_raw_agrihq():
            print('New data for AgriHQ.')
        else:
            print('Nothing to be done.')
    except:
        print(get_last_error())
    print('-------------------------------------------------------------------')
