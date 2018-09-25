var d3 = Plotly.d3;

function load_json(filename, callback) {
    var xml_request = new XMLHttpRequest();
    xml_request.overrideMimeType("application/json");
    xml_request.open('GET', filename, true);
    xml_request.onreadystatechange = function() {
        if (xml_request.readyState == 4 && xml_request.status == "200") {
            // Required use of an anonymous callback as .open will NOT return a
            // value but simply returns undefined in asynchronous mode
            callback(JSON.parse(xml_request.responseText));
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

function default_line_series(x, y, name) {
    return {
        x: x,
        y: y,
        name: name,
        type: 'scatter',
        line: {
            shape: 'hv'
        }
    }
}

function forecast_median_series(forecasts) {
    var x = key_from_series(forecasts, 'date')
    var y = key_from_series(forecasts, '50%')
    x.push(Date.now())
    y.push(last(forecasts)['50%'])
    series = default_line_series(x, y, 'Best Guess')
    series['line']['color'] = '#01579b'
    return series
}

function forecast_ribbon_series(forecasts) {
    var x = []
    var y = []
    // For a ribbon plot, we need to go along the bottom, ...
    for (i = 0; i < forecasts.length - 1; i++) {
        x.push(forecasts[i]["date"])
        x.push(forecasts[i + 1]["date"])
        y.push(forecasts[i]['10%'])
        y.push(forecasts[i]['10%'])
    }
    // ... then loop up along the right-hand edge, ...
    x.push(Date.now())
    x.push(Date.now())
    y.push(last(forecasts)['10%'])
    y.push(last(forecasts)['90%'])
    // ... head back along the top, ...
    for (i = forecasts.length - 1; i > 0; i--) {
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
        showLegend: false
    }
}

(function() {
    var charts = []
    /* =========================================================================
        Plot forecasts by dairyanalytics this season.
    ========================================================================= */
    load_json('forecasts.json', function(forecast_json) {
        set_textual_forecast(forecast_json)
        var forecast_chart = d3.select('#forecast_chart').node()
        var first_date = first(forecast_json)["date"]
        var final_date = (parseInt(first_date.slice(0, 4)) + 1).toString() + "-09-30"
        var layout = default_layout('Milk Price (NZD/kgMS)')
        layout['xaxis'] = {
            range: [first_date, final_date]
        }
        layout['yaxis']['range'] = [3, 9]
        Plotly.plot(forecast_chart, [
            forecast_ribbon_series(forecast_json),
            forecast_median_series(forecast_json)
        ], layout);
        charts.push(forecast_chart)
    })
    /* =========================================================================
        Plot historical Fonterra forecasts.
    ========================================================================= */
    load_json('fonterra_forecasts.json', function(fonterra_json) {
        var fonterra_chart = d3.select('#fonterra_chart').node()
        Plotly.plot(fonterra_chart,
            Object.keys(fonterra_json).map(function(key, index) {
                return default_line_series(
                    key_from_series(fonterra_json[key], 'date'),
                    key_from_series(fonterra_json[key], 'forecast'),
                    key
                )
            }),
            default_layout('Milk Price (NZD/kgMS)'));
        charts.push(fonterra_chart)
    })
    /* =========================================================================
        Plot historical GDT events.
    ========================================================================= */
    load_json('gdt_events.json', function(gdt_json) {
        var gdt_chart = d3.select('#gdt_events_chart').node()
        var layout = default_layout('Price(USD / tonne')
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
    /* =========================================================================
        Resizing stuff.
    ========================================================================= */
    window.onresize = function() {
        charts.map(function(chart) {
            Plotly.Plots.resize(chart)
        })
    };
})();