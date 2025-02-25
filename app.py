from flask import Flask, render_template, jsonify
from flask_socketio import SocketIO
import os
from twilio.rest import Client

app = Flask(__name__)
app.debug = True
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")

# generate the ICE configuration on the server
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)
token = client.tokens.create()

@app.route("/")
def index():
    return render_template('index.html')

@app.route('/ice-config')
def get_ice_config():
    return jsonify({"iceServers": token.ice_servers})

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
def handle_candidateRec(data):
    socketio.emit('candidateRec', data)

@app.route('/receiver_disconnect', methods=['POST'])
def handle_receiver_disconnect():
    socketio.emit('byeBye')

if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000)