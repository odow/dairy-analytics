var d3 = Plotly.d3;

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

(function() {
    var forecasts = season_2018_19
    set_textual_forecast(forecasts)
    var forecast_chart = d3.select('#forecast_chart').append('div').style({
        width: '100%'
    }).node();
    forecasts
    Plotly.plot(forecast_chart, [
            ribbon_plot(forecasts, "10%", "90%", "rgba(1, 87, 155, 0.25)", "4-in-5 Range"),
            line_plot(forecasts, "50%", "rgba(1, 87, 155, 1)", "Best Guess")
        ],
        get_layout_options(forecasts)
    );
    window.onresize = function() {
        Plotly.Plots.resize(forecast_chart)
    };
})();