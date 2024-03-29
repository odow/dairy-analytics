#! /bin/bash

# cd to dairy-analytics/
cd ~/dairy-analytics

# Pull any updates from git.
git pull

# The scripts to run.
python3 src/model.py >> 'docs/log.txt'

# Push any changes to Github.
git add .
git commit -m "Automatic update script."
git push
