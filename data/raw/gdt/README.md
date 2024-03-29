# GlobalDairyTrade data

The file `events.csv` contains historical average winning prices (USD/tonne)
published by GlobalDairyTrade for five products:
 - amf: anhydrous milk fat
 - but: butter
 - bmp: butttermilk powder
 - smp: skim milk powder
 - wmp: whole milk powder

This data is sourced from the spreadsheet `Trading Events Historical Data.xls`
(see below for more), and via manual collation.

The file `nzx_settlements.json` contains historical GDT prices (USD/tonne) used
by the NZX to settle their GDT futures contracts. The prices are
 - wmp: WMP Regular NZ – C2
 - smp: SMP Medium Heat NZ – C2
 - amf: AMF Regular 210kg drum – NZ/AU C2
 - but: BTR Unsalted 25kg – NZ C2.
These were scraped from https://www.nzx.com/markets/nzx-dairy-derivatives/global-dairy-trade/218/gdt_price_report.

The `Trading Events Historical Data.xls` comes directly from GlobalDairyTrade.
It used to be made available for free but it has since (as of July 2016) been
moved behind a pay-wall.

However, contained within the spreadsheet is an explicit clause allowing the
spreadsheet to be reproduced provided the source is acknowledged.

    "All information published in this spread sheet may be reproduced provided
    the user acknowledges GlobalDairyTrade as the source. The data contained in
    this document is provided subject to the Terms of Use ("Terms") published on
    http://www.globaldairytrade.info/ as applicable to information materials
    provided or published on that site. By accessing, viewing, or downloading
    these data, you acknowledge the application of the terms."

The current terms of use (as of 22 August 2018) at https://www.globaldairytrade.info/en/generic-pages/terms-of-use/
also include the clause that

    "If there is any conflict or inconsistency between these Terms and those
    other product or service-specific terms, conditions or rules, the product or
    service-specific terms, conditions or rules will prevail."

Therefore, we believe we are within our rights to publish this historical data.

Source:
https://www.globaldairytrade.info/en/product-results/download-historical-data-for-gdt-events/
