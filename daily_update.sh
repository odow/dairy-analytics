#! /bin/bash

# cd to dairy-analytics/
cd ~/dairy-analytics

# Pull any updates from git.
git pull

# The scripts to run.
python3 src/scrape_data.py >> 'docs/log.txt'
python3 src/model.py >> 'docs/log.txt'

cat data/raw/nzx/NZXMKP-* | sort | 
  tail -n +$(ls data/raw/nzx/NZXMKP-* | wc -l) > data/processed/nzx_mkp.csv

# Push any changes to Github.
git add .
git commit -m "Automatic update script."
git push
