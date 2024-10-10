//  Copyright 2015-2023, Oscar Dowson.
//
//  This Source Code Form is subject to the terms of the Mozilla Public
//  License, v. 2.0. If a copy of the MPL was not distributed with this
//  file, You can obtain one at https://mozilla.org/MPL/2.0/.

M.Tabs.init(
    document.getElementById("forecast_tabs"), 
    {onShow: chart => Plotly.Plots.resize(chart)},
);

M.Tabs.init(
    document.getElementById("globaldairytrade_tabs"), 
    {onShow: arg => Plotly.Plots.resize(arg.children[1])},
);

var d3 = Plotly.d3;

function load_json(filename, callback) {
    var xml_request = new XMLHttpRequest();
    xml_request.overrideMimeType("application/json");
    xml_request.open('GET', filename, true);
    // xml_request.setRequestHeader("Access-Control-Allow-Origin","*")
    xml_request.onreadystatechange = function() {
        if (xml_request.readyState == 4) {
            if (xml_request.status == "200" || xml_request.status == "0") {
                // Required use of an anonymous callback as .open will NOT return a
                // value but simply returns undefined in asynchronous mode
                callback(JSON.parse(xml_request.responseText));
            } else {
                console.log("error getting " + filename);
                console.log(xml_request);
            }
        }
    };
    xml_request.send(null);
}

function first(x) {
    return x[0]
}

function last(x) {
    return x[x.length - 1]
}

function set_span(span_id, value) {
    document.getElementById(span_id).textContent = value;
}

function set_textual_forecast(forecasts) {
    set_span("lower_estimate", last(forecasts)["10%"])
    set_span("upper_estimate", last(forecasts)["90%"])
    set_span("best_estimate", last(forecasts)["50%"])
    set_span("last_updated", last(forecasts)["date"])
}

function key_from_series(data, key) {
    // Given data in the form: `data = [{'key': value1}, {'key': value2} ...]`,
    //return `[value1, value2, ...]`.
    return data.map(function(d) {
        return d[key]
    })
}

function default_line_series(x, y, name, key) {
    return {
        x: x,
        y: y,
        legendgroup: key,
        name: name,
        type: 'scatter',
        line: {
            shape: 'hv'
        }
    }
}

function forecast_median_series(forecasts, use_current_date) {
    var x = key_from_series(forecasts, 'date')
    var y = key_from_series(forecasts, '50%')
    if (use_current_date) {
        current_date = new Date().toJSON().slice(0, 10)
        x.push(current_date)
    } else {
        x.push(last(forecasts)['date'])
    }
    y.push(last(forecasts)['50%'])
    series = default_line_series(x, y, 'Best Guess', '')
    series['line']['color'] = '#01579b'
    return series
}

function forecast_ribbon_series(forecasts, use_current_date) {
    last_forecast = Object.create(last(forecasts))
    if (use_current_date) {
        last_forecast["date"] = new Date().toJSON().slice(0, 10)
    }
    forecasts.push(last_forecast)

    var x = []
    var y = []
    // For a ribbon plot, we need to go along the bottom, ...
    for (i = 0; i < forecasts.length - 1; i++) {
        x.push(forecasts[i]["date"])
        x.push(forecasts[i + 1]["date"])
        y.push(forecasts[i]['10%'])
        y.push(forecasts[i]['10%'])
    }
    // ... head back along the top, ...
    for (i = forecasts.length-1; i > 0; i--) {
        x.push(forecasts[i]["date"])
        x.push(forecasts[i - 1]["date"])
        y.push(forecasts[i]['90%'])
        y.push(forecasts[i - 1]['90%'])
    }
    // ... and finally back down to the start.
    x.push(forecasts[0]["date"])
    y.push(forecasts[0]['10%'])
    return {
        x: x,
        y: y,
        name: '4-in-5 Range',
        type: 'scatter',
        fill: 'tozerox',
        fillcolor: '#01579b50',
        line: {
            color: "transparent",
            shape: 'vh'
        }
    }
}

function get_low_high(data) {
    low = data["forecast"]
    high = data["forecast"]
    if ('low' in data) {
        low = data["low"]
    }
    if ('high' in data) {
        high = data["high"]
    }
    return {'low': low, 'high': high}
}

function fonterra_ribbon_series(forecasts, is_current_season, key, color) {
    last_forecast = Object.create(last(forecasts))
    if (is_current_season) {
        last_forecast["date"] = new Date().toJSON().slice(0, 10)
        forecasts.push(last_forecast)
    } else if (forecasts.length < 2) {
        console.log("Too few forecasts")
        return {}
    }

    var x = []
    var y = []
    // For a ribbon plot, we need to go along the bottom, ...
    for (i = 0; i < forecasts.length - 1; i++) {
        x.push(forecasts[i]["date"])
        x.push(forecasts[i + 1]["date"])
        fi = get_low_high(forecasts[i])
        y.push(fi['low'])
        y.push(fi['low'])
    }
    // ... head back along the top, ...
    for (i = forecasts.length-1; i > 0; i--) {
        x.push(forecasts[i]["date"])
        x.push(forecasts[i - 1]["date"])
        fi = get_low_high(forecasts[i])
        y.push(fi['high'])
        fi = get_low_high(forecasts[i-1])
        y.push(fi['high'])
    }
    // ... and finally back down to the start.
    x.push(forecasts[0]["date"])
    fi = get_low_high(forecasts[0])
    y.push(fi['low'])
    return {
        x: x,
        y: y,
        showlegend: false,
        name: key,
        legendgroup: key,
        type: 'scatter',
        fill: 'tozerox',
        fillcolor: color,
        line: {
            color: "transparent",
            shape: 'vh'
        }
    }
}

function forecast_actual(first_date, last_date, payout) {
    return {
        x: [first_date, last_date],
        y: [payout, payout],
        show_legend: true,
        name: 'Final payout',
        line: {
            color: 'red'
        }
    }
}

function default_layout(y_axis_title) {
    return {
        hovermode: 'closest',
        yaxis: {
            title: y_axis_title,
            tickprefix: "$",
            titlefont: {
                family: 'Verdana, National, sans-serif',
            }
        },
        margin: {
            r: 0,
            t: 20
        },
        showlegend: true,
        legend: {"orientation": "h"}
    }
}

function plot_forecasts(charts, json_file, chart_name, end_date, final_price) {
    load_json(json_file, function(forecast_json) {
        if (json_file == 'forecasts.json') {
            set_textual_forecast(forecast_json)
        }
        var forecast_chart = d3.select(chart_name).node()
        var first_date = first(forecast_json)["date"]
        var final_date = (parseInt(first_date.slice(0, 4)) + 1).toString() + end_date
        var layout = default_layout('Milk Price [NZD/kgMS]')
        layout['showlegend'] = false
        layout['xaxis'] = {
            range: [first_date, final_date]
        }
        layout['yaxis']['range'] = [0, 12]
        var series = [
            forecast_ribbon_series(forecast_json, true),
            forecast_median_series(forecast_json, true)
        ];
        if (final_price != null) {
            series.push(forecast_actual(first_date, final_date, final_price))
        }
        Plotly.plot(forecast_chart, series, layout);
        charts.push(forecast_chart)
    });
}

function annual_fx_rate(actual_json, key) {
    var x = [];
    var y = [];
    for (i = 0; i < actual_json.length; i++) {
        data = actual_json[i];
        x.push(data['season'] + '-06-01')
        y.push(data[key])
        x.push((data['season'] + 1) + '-05-31')
        y.push(data[key])
        x.push(null)
        y.push(null)
    }
    ret = {'x': x, 'y': y, 'name': key + ' (annual)'}
    if (key != 'hedge') {
        ret['visible'] = 'legendonly'
    }
    return ret
}
function quarterly_fx_rate(hedge_json, key) {
    var x = [];
    var y = [];
    offsets = {
        'spot': [[0, '06'], [0, '09'], [0, '12'], [1, '03'], [1, '06'], [1, '09']],
        'hedge': [[0, '06'], [0, '09'], [0, '12'], [1, '03'], [1, '06'], [1, '09']]
    }
    for (i = 0; i < hedge_json.length; i++) {
        data = hedge_json[i];
        offset = offsets[key][data['quarter'] - 1];
        x.push((data['season'] + offset[0]) + '-' + offset[1] + '-01')
        y.push(data[key])
        if (data['quarter'] == 5) {
            offset = offsets[key][5]
            x.push((data['season'] + offset[0]) + '-' + offset[1] + '-01')
            y.push(data[key])
            x.push(null)
            y.push(null)
        }
    }
    return {'x': x, 'y': y, 'name': key, 'line': {'shape': 'hv'}, 'visible': 'legendonly'}
}

(function() {
    var charts = []
    /* =========================================================================
        Plot forecasts by dairyanalytics
    ========================================================================= */
    plot_forecasts(charts, 'forecasts.json', '#forecast_chart', '-05-31', null)
    var archived = {
        '2023_24': 7.83,
        '2022_23': 8.22,
        '2021_22': 9.30,
        '2020_21': 7.54,
        '2019_20': 7.14,
        '2018_19': 6.35,
        '2017_18': 6.74,
        '2016_17': 6.12
    }
    for (let [key, value] of Object.entries(archived)) {
        plot_forecasts(
            charts,
            'archive_' + key + '.json',
            '#forecast_' + key + '_chart',
            '-05-31',
            value
        )
    };
    /* =========================================================================
        Plot historical Fonterra forecasts.
    ========================================================================= */
    load_json('fonterra_forecasts.json', function(fonterra_json) {
        var current_season = '2024-25';
        var most_recent_forecast = last(fonterra_json[current_season]);
        fonterra_json[current_season].push({
            'date': new Date().toJSON().slice(0, 10),
            'forecast': most_recent_forecast['forecast'],
            'low': most_recent_forecast['low'],
            'high': most_recent_forecast['high']
        });
        var fonterra_chart = d3.select('#fonterra_chart').node()
        median_forecasts = Object.keys(fonterra_json).map(function(key, index) {
            return default_line_series(
                key_from_series(fonterra_json[key], 'date'),
                key_from_series(fonterra_json[key], 'forecast'),
                key, key
            )
        });
        // Programatically query the default Plotly colors so we can fill in the
        // ribbons with the appropriate color. If Plotly changes the default
        // color scale, this will need changing.
        var color_scale = d3.scale.category10()
        var colors = [];
        for (var i = 0; i < 11; i += 1) {
            colors.push(color_scale(i));
        }
        // This variable sets the opacity of the ribbons. Decrease it to make
        // the ribbons more transparent.
        var opacity = 'aa'
        // The default Plotly color scheme has 10 distinct colors. The 2019-20
        // season is the 11'th for which we have data, so it is colored the same
        // as the first (the 0'th in the array `colors`).
        median_forecasts.push(
            fonterra_ribbon_series(
                fonterra_json["2018-19"], false, "2018-19", colors[9] + opacity
            ),
            fonterra_ribbon_series(
                fonterra_json["2019-20"], false, "2019-20", colors[0] + opacity
            ),
            fonterra_ribbon_series(
                fonterra_json["2020-21"], false, "2020-21", colors[1] + opacity
            ),
            fonterra_ribbon_series(
                fonterra_json["2021-22"], false, "2021-22", colors[2] + opacity
            ),
            fonterra_ribbon_series(
                fonterra_json["2022-23"], false, "2022-23", colors[3] + opacity
            ),
            fonterra_ribbon_series(
                fonterra_json["2023-24"], true, "2023-24", colors[4] + opacity
            ),
            fonterra_ribbon_series(
                fonterra_json["2024-25"], true, "2024-25", colors[5] + opacity
            )
        );
        layout = default_layout('Milk Price [NZD/kgMS]')
        layout['yaxis']['range'] = [0, 12]
        layout['showlegend'] = false
        Plotly.plot(fonterra_chart, median_forecasts, layout);
        charts.push(fonterra_chart)
    })
    /* =========================================================================
        Plot historical GDT events.
    ========================================================================= */
    load_json('gdt_events.json', function(gdt_json) {
        var gdt_chart = d3.select('#gdt_events_chart').node()
        var layout = default_layout('Price [USD/tonne]')
        layout['hovermode'] = 'compare'
        Plotly.plot(gdt_chart, [
            default_line_series(gdt_json['date'], gdt_json['amf'], 'AMF'),
            default_line_series(gdt_json['date'], gdt_json['bmp'], 'BMP'),
            default_line_series(gdt_json['date'], gdt_json['but'], 'BUT'),
            default_line_series(gdt_json['date'], gdt_json['smp'], 'SMP'),
            default_line_series(gdt_json['date'], gdt_json['wmp'], 'WMP')
        ], layout);
        charts.push(gdt_chart)
    })
    load_json('sales.json', function(gdt_json) {
        var gdt_chart = d3.select('#gdt_events_quantity_chart').node()
        var series = []
        var products = ['AMF', 'BMP', 'Butter', 'SMP', 'WMP']
        for (var i = 0; i < products.length; i++) {
            x = default_line_series(
                gdt_json.map(x => x['date']),
                gdt_json.map(x => x[products[i]] / 24),
                (products[i] == 'Butter' ? 'BUT' : products[i])
            )
            x['stackgroup'] = 'one'
            series.push(x)
        }
        series.push(
            default_line_series(
                gdt_json.map(x => x['date']),
                gdt_json.map(x => x['QuantitySold']),
                'All products'
            )
        )
        Plotly.plot(gdt_chart, series, {
            hovermode: 'closest',
            yaxis: {
                title: 'Sales quantity [tonne]',
                titlefont: {
                    family: 'Verdana, National, sans-serif',
                },
                range: [0, 60_000]
            },
            margin: {
                r: 0,
                t: 20
            },
            showLegend: false,
            legend: {"orientation": "h"}
        });
        charts.push(gdt_chart)
    });
    /* =========================================================================
        Plot FX rate.
    ========================================================================= */
    load_json('fx.json', function(fx_json) {
        load_json('fx_hedge.json', function(hedge_json) {
            load_json('fx_actual.json', function(actual_json) {
                var fx_chart = d3.select('#fx_chart').node();
                var series = [
                    default_line_series(
                        fx_json.map(x => x['date']),
                        fx_json.map(x => x['rate']),
                        'NZD:USD'
                    ),
                    annual_fx_rate(actual_json, 'hedge'),
                    annual_fx_rate(actual_json, 'spot'),
                    quarterly_fx_rate(hedge_json, 'hedge'),
                    quarterly_fx_rate(hedge_json, 'spot')
                ];
                Plotly.plot(fx_chart, series, {
                    hovermode: 'closest',
                    yaxis: {
                        title: 'Exchange rate [NZD:USD]',
                        titlefont: {
                            family: 'Verdana, National, sans-serif',
                        }
                    },
                    margin: {
                        r: 0,
                        t: 20
                    },
                    showLegend: false,
                    legend: {"orientation": "h"}
                });
                charts.push(fx_chart)
            });
        });
    });
    /* =========================================================================
        Resizing stuff.
    ========================================================================= */
    window.onresize = function() {
        charts.map(function(chart){
            if (window.getComputedStyle(chart).display == "block") {
                Plotly.Plots.resize(chart)
            }
        })
    };
})();
