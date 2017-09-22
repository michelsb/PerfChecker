#!/usr/bin/python

from flask import Flask
from flask import render_template

from manager import MiningManager
import json
from bson import json_util
from bson.json_util import dumps

app = Flask(__name__)
manager = MiningManager()
manager.start_manager()

@app.route("/perfchecker")
def index():
    return render_template("index.html")

@app.route("/perfchecker/results")
def perfchecker_results():
    results = manager.collect()
    json_results = json.dumps(results, default=json_util.default)
    return json_results

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=8080, debug=True, use_reloader=False)
