var d3 = Plotly.d3;

function load_json(filename, callback) {
    var xml_request = new XMLHttpRequest();
    xml_request.overrideMimeType("application/json");
    xml_request.open('GET', filename, true);
    xml_request.onreadystatechange = function() {
        if (xml_request.readyState == 4 && xml_request.status == "200") {
            // Required use of an anonymous callback as .open will NOT return a
            // value but simply returns undefined in asynchronous mode
            callback(xml_request.responseText);
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
    return data.map(function(d) {
        return d[key]
    })
}

function line_plot(forecasts, key, colour, name) {
    var x = key_from_series(forecasts, 'date')
    var y = key_from_series(forecasts, key)
    x.push(Date.now())
    y.push(last(forecasts)[key])
    return {
        x: x,
        y: y,
        name: name,
        type: 'scatter',
        line: {
            color: colour,
            shape: 'hv'
        }
    }
}

function ribbon_plot(forecasts, lower, upper, colour, name) {
    var x = []
    var y = []
    // For a ribbon plot, we need to go along the bottom, ...
    for (i = 0; i < forecasts.length - 1; i++) {
        x.push(forecasts[i]["date"])
        x.push(forecasts[i + 1]["date"])
        y.push(forecasts[i][lower])
        y.push(forecasts[i][lower])
    }
    // ... then loop up along the right-hand edge, ...
    x.push(Date.now())
    x.push(Date.now())
    y.push(last(forecasts)[lower])
    y.push(last(forecasts)[upper])
    // ... head back along the top, ...
    for (i = forecasts.length - 1; i > 0; i--) {
        x.push(forecasts[i]["date"])
        x.push(forecasts[i - 1]["date"])
        y.push(forecasts[i][upper])
        y.push(forecasts[i - 1][upper])
    }
    // ... and finally back down to the start.
    x.push(forecasts[0]["date"])
    y.push(forecasts[0][lower])
    return {
        x: x,
        y: y,
        name: name,
        type: 'scatter',
        fill: 'tozerox',
        fillcolor: colour,
        line: {
            color: "transparent",
            shape: 'vh'
        }
    }
}

function gdt_events_line(gdt_events, key, name) {
    return {
        x: gdt_events['date'],
        y: gdt_events[key],
        name: name,
        type: 'scatter',
        line: {
            shape: 'hv'
        }
    }
}

function fonterra_json_to_line(fonterra_json, key) {
    return {
        x: key_from_series(fonterra_json[key], 'date'),
        y: key_from_series(fonterra_json[key], 'forecast'),
        name: key,
        type: 'scatter',
        line: {
            shape: 'hv'
        }
    }
}
(function() {
    var charts = []
    /* =========================================================================
        Plot forecasts by dairyanalytics this season.
    ========================================================================= */
    load_json('forecasts.json', function(response) {
        var forecasts = JSON.parse(response)
        set_textual_forecast(forecasts)
        var forecast_chart = d3.select('#forecast_chart').append('div').style({
            width: '100%'
        }).node();
        var first_date = first(forecasts)["date"]
        var final_date = (parseInt(first_date.slice(0, 4)) + 1).toString() + "-09-30"
        Plotly.plot(forecast_chart, [
            ribbon_plot(forecasts, "10%", "90%", "rgba(1, 87, 155, 0.25)", "4-in-5 Range"),
            line_plot(forecasts, "50%", "rgba(1, 87, 155, 1)", "Best Guess")
        ], {
            hovermode: 'closest',
            xaxis: {
                range: [first_date, final_date]
            },
            yaxis: {
                title: 'Milk Price ($/kgMS)',
                range: [3, 9],
                tickprefix: "$",
                titlefont: {
                    family: 'Verdana, National, sans-serif',
                }
            },
            margin: {
                r: 0,
                t: 20
            },
            showLegend: false
        });
        charts.push(forecast_chart)
    })
    /* =========================================================================
        Plot historical Fonterra forecasts.
    ========================================================================= */
    load_json('fonterra_forecasts.json', function(response) {
        var fonterra_json = JSON.parse(response)
        var fonterra_chart = d3.select('#fonterra_chart').append('div').style({
            width: '100%'
        }).node();
        Plotly.plot(
            fonterra_chart,
            Object.keys(fonterra_json).map(function(key, index) {
                return fonterra_json_to_line(fonterra_json, key)
            }), {
                hovermode: 'closest',
                yaxis: {
                    title: 'Milk Price (NZD/kgMS)',
                    tickprefix: "$",
                    titlefont: {
                        family: 'Verdana, National, sans-serif',
                    }
                },
                margin: {
                    r: 0,
                    t: 20
                },
                showLegend: false
            });
        charts.push(fonterra_chart)
    })
    /* =========================================================================
        Plot historical GDT events.
    ========================================================================= */
    load_json('gdt_events.json', function(response) {
        var gdt_events = JSON.parse(response)
        var gdt_events_chart = d3.select('#gdt_events_chart').append('div').style({
            width: '100%'
        }).node();
        Plotly.plot(gdt_events_chart, [
            gdt_events_line(gdt_events, 'amf', 'AMF'),
            gdt_events_line(gdt_events, 'bmp', 'BMP'),
            gdt_events_line(gdt_events, 'but', 'BUT'),
            gdt_events_line(gdt_events, 'smp', 'SMP'),
            gdt_events_line(gdt_events, 'wmp', 'WMP')
        ], {
            hovermode: 'closest',
            yaxis: {
                title: 'Price (USD/tonne)',
                tickprefix: "$",
                titlefont: {
                    family: 'Verdana, National, sans-serif',
                }
            },
            margin: {
                r: 0,
                t: 20
            },
            showLegend: false
        });
        charts.push(gdt_events_chart)
    })
    /* =========================================================================
        Resizing stuff.
    ========================================================================= */
    window.onresize = function() {
        charts.map(function(chart) {
            Plotly.Plots.resize(chart)
        })
    };
})();