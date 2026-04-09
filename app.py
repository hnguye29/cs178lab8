import time

import numpy as np
import pandas as pd
from flask import Flask, render_template, request

app = Flask(__name__)
datasets = ["blobs", "circles", "lines", "moons", "uniform"]


@app.route("/")
def index():
    return render_template("index.html", datasets=datasets)


# example POST request handle
@app.route("/your_route", methods=["POST"])
def your_route_func():
    # parse request sent from the front end
    request_data = request.get_json()
    print("request_data", request_data)

    # return data to front end
    return dict(msg="a", data={"a": 1, "b": 2})


if __name__ == "__main__":
    app.run(debug=True)
