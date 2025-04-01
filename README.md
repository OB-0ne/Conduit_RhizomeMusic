# *Conduit* for *Rhizome Music*

Conduit is a WebRTC-powered web application that enables audience members to contribute live audio to performances through their phone microphones. Conduit establishes real-time connections between participants and performers, creating a collaborative sound experience for interactive musical and artistic performance

## Features
- Real-time peer-to-peer connection
- Simple UI for audience members to connect their mic with the performer
- Mixer like UI for performer to view all audio connections and control their gain
- Automatically looks for TURN servers (if configured) when networks policies are strict

## Performance Architecture
![Conduit's performance architecture for Rhizome Music](https://i.imgur.com/gOSZBFK.png)

## Installation & Setup

### API Keys for TURN server
- Acquire API Key ID and Auth Token for connecting to TURN servers
- The current '*app.py*' looks for these as secret variables on the hosting server
- The current project used [Twilio](https://www.twilio.com/en-us/stun-turn) - they provide some free credits to get started
- To remove the TURN servers, function '*get_ice_config()*' needs to be edited in the '*app.py*' file

### Development and Testing
- Current build works on Python 3.9.0
- [Optional] Make a pyhton virtual environment for the libraries
    ```bash
        # Make virtual environment named 'virtual'
        python -m venv virtual
        
        #Run the virtual environment
        source virtual/Scripts/activate
    ```
- Install needed python libraries
    ``` bash
        pip install -r requirements.txt
    ```
- Start the local server for testing debugging
    ``` bash
        python app.py
    ```

### Deployment and Live
- Clone the repositiory
- Most web hosting websites should let you link your new repo for auto deployment
- Rhizome Music was hosted on [railway.app](https://railway.com/) - which also has a free tier for small projects
- Add the following Custom Start Command to run app on the server
    ``` bash
        gunicorn --worker-class eventlet -w 1 app:app
    ```

## Performance Setup
- Performer page can be accessed by adding '/laptop_performer' to the deployed url
- The url is to be shared with the audience (QR codes work the best!)
- Performer to click 'Start Stream' before sharing the link - the signal should turn green to indicate the activity
- Audience can click the mic symbol to join the stream, while they need to allow any mic permissions requested by their phone/browser.
- Performer should be able to view all connections on their page, with their status, volumne slider, gain indicator and a high-pass indicater

## Customization
- Update '*welcomeMsgs*' list in '*sender.js*' for any new messages for audience to view
- Update '*aud_effect_constraints*' list in '*sender.js*' to change the audio setting for the audience mic
- Use '*remoteStream*' list in '*receiver.js*' for any custom functions for editing the incoming audio, or to use it for any visualizations

## Contribution and Licensing
The project is open-source and freely available for use. Attribution is appreciated when reusing or modifying the code. If you need any assistance in setting up, editing, or adapting Conduit for your performance, feel free to reach out.

## Performance Links
*-----To be Released-----*

## 

*This project was made was in collaboration with [Rob Cosgrove](https://robcosgrove.com/) and [Ensemble Decipher](https://ensembledecipher.com/), with funding from American Composers Forun's ACF|create.*