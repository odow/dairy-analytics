# Dairy Analytics

This repository contains all of the code and data used to build and run
[dairyanalytics.co.nz](https://dairyanalytics.co.nz).

## About

The goal of the model is to provide a probabilistic forecast of the Fonterra
farmgate milk price.

## The model

The model is implemented as a single Python script. This repository is
intentionally "bare-bones," and it does not contain tests or validation data.

 * Source code for the model is available in the `src/model.py` file
 * Outputs are published in the `/docs` directory
 * Raw and partially processed data is stored in the `/data` directory

We will not be documenting the underlying mathematics of the model. Consult the
source code for details.

Astute readers may find that the underlying model is surprisingly basic. We have
attempted to improve the model over the years, but in our experience the
publicly available data sources do not contain useful predictors.

Two key areas of improvement to consider are:

 1. A way to estimate Fonterra's USD:NZD exchange rate
 2. A way to estimmate Fonterra's capital and processing costs

Currently, these two fields are set using expert judgement in the
`docs/config.json` file.

To use a different config file, set the `DAIRY_ANALYTICS_CONFIG` environment
variable.

## License

The source code in this repository is available under the
[MPL-2.0 license](https://mozilla.org/MPL/2.0/).

At a high level, this means you are free to use the code in commercial and
non-commercial products. However, if you modify the source code of these files
_and then distribute them to a third-party_, then you must make the new source
code available under the MPL-2.0 license.

## Contact

For comments, criticisms, and suggestions, please open a GitHub issue.
