import json, os
from pathlib import Path
project_dir = Path(__file__).resolve().parents[2]

import io, traceback
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText


def data_dir(filename, dir='raw'):
    project_dir = Path(__file__).resolve().parents[2]
    return os.path.join(project_dir, 'data', dir, filename)

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
