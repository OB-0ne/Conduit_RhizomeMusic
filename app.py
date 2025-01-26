from flask import Flask, render_template
app = Flask(__name__)
app.debug = True

@app.route("/")
def index():
    return render_template('index.html')

@app.route("/laptop_Rob")
def receiver_page():
    return render_template('receiver.html')

if __name__ == "__main__":
    app.run()      