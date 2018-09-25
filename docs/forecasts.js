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

function today() {
    return Date.now()
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

function line_plot(forecasts, key, colour, name) {
    var x = forecasts.map(function(f) {
        return f["date"]
    })
    var y = forecasts.map(function(f) {
        return f[key]
    })
    x.push(today())
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
    // For a ribbon plot, we need to go along the bottom, then loop up along the
    // right-hand edge, and head back toward the start.
    var x = []
    var y = []
    for (i = 0; i < forecasts.length - 1; i++) {
        x.push(forecasts[i]["date"])
        x.push(forecasts[i + 1]["date"])
        y.push(forecasts[i][lower])
        y.push(forecasts[i][lower])
    }
    x.push(today())
    x.push(today())
    y.push(last(forecasts)[lower])
    y.push(last(forecasts)[upper])
    for (i = forecasts.length - 1; i > 0; i--) {
        x.push(forecasts[i]["date"])
        x.push(forecasts[i - 1]["date"])
        y.push(forecasts[i][upper])
        y.push(forecasts[i - 1][upper])
    }
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

function get_layout_options(forecasts) {
    var first_date = first(forecasts)["date"]
    var final_date = (parseInt(first_date.slice(0, 4)) + 1).toString() + "-09-30"
    return {
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

function gdt_events_layout() {
    return {
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
    }
}

(function() {
    var charts = []
    load_json('forecasts.json', function(response) {
        var forecasts = JSON.parse(response)
        set_textual_forecast(forecasts)
        var forecast_chart = d3.select('#forecast_chart').append('div').style({
            width: '100%'
        }).node();
        Plotly.plot(forecast_chart, [
                ribbon_plot(forecasts, "10%", "90%", "rgba(1, 87, 155, 0.25)", "4-in-5 Range"),
                line_plot(forecasts, "50%", "rgba(1, 87, 155, 1)", "Best Guess")
            ],
            get_layout_options(forecasts)
        );
        charts.push(forecast_chart)
    })
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
            ],
            gdt_events_layout()
        );
        charts.push(gdt_events_chart)
    })
    window.onresize = function() {
        charts.map(function(chart) {
            Plotly.Plots.resize(chart)
        })
    };
})();