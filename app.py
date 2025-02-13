from flask import Flask, render_template
from flask_socketio import SocketIO

app = Flask(__name__)
app.debug = True
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="gevent")
# socketio = SocketIO(app, cors_allowed_origins="*")      # ONLY FOR DEV TESTING

@app.route("/")
def index():
    return render_template('index.html')

@app.route("/laptop_Rob")
def receiver_page():
    return render_template('receiver.html')

@socketio.on('offer')
def handle_offer(data):
    socketio.emit('offer', data)

@socketio.on('answer')
def handle_answer(data):
    socketio.emit('answer', data)

@socketio.on('candidate')
def handle_candidate(data):
    socketio.emit('candidate', data)

@socketio.on('candidateRec')
def handle_candidate(data):
    socketio.emit('candidateRec', data)

if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000)
    # socketio.run(app)       # ONLY FOR DEV TESTING