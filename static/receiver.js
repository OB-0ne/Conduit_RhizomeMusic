var socket = io.connect(window.location.origin);

let peerConnections = {}; // Store peer connections keyed by socket ID

// custom STUN Server for NAT traversal from servers
async function fetchIceConfig() {
    try {
        const response = await fetch(window.location.origin + "/ice-config");
        const iceConfig = await response.json();
        return iceConfig;
    } catch (error) {
        console.error("Failed to fetch ICE config:", error);
        return { iceServers: [] };  // Fallback to an empty config
    }
}

async function playStream() {
    
    // get the custom NAT/STUN/TURN servers from the server
    const rtcConfig = await fetchIceConfig();

    // update the stream activity info
    document.getElementById('streamActiveInfoStatus').innerHTML = "ACTIVE"
    document.getElementById('streamActiveInfoStatus').style.color = "green";

    // handle the 'offer' which is sent by the sender
    socket.on('offer', async ({ offer, senderId }) => {

        // check if this senderID already exists, and if yes, do not add audio controls for it
        // also exit the function to avoid duplicate audio UI
        if (peerConnections[senderId]){
            console.log('Sender already connected');
            return;
        }

        // create a new peer connection with custom config
        const peerConnection = new RTCPeerConnection(rtcConfig);
        // add it to the list with senderID as key
        peerConnections[senderId] = peerConnection;

        // Send ICE candidates to the sender for completing the connection
        peerConnection.onicecandidate = event => {
            if (event.candidate) {
                socket.emit('candidateRec', { candidate: event.candidate, originalSenderId: senderId });
            }
        };

        // Handle incoming audio stream and convert to UI element
        peerConnection.ontrack = event => {
            
            // make HTML all custom components to be added
            const audio_container = document.createElement('div');
            const audio_level = document.createElement('input');
            const audio_num = document.createElement('span');
            const audio_activity = document.createElement('span');
            const audio_vol_threshold = document.createElement('span');
            const audio = document.createElement('audio');
            const remoteStream = event.streams[0];
            
            // add a number to identify the audio stream
            audio_num.innerHTML = Object.keys(peerConnections).length;
            audio_num.setAttribute('class','audio-number');
            audio_container.appendChild(audio_num);

            // add an audio activity circle - shows if connection is still valid
            audio_activity.setAttribute('class','audio-threshold');
            audio_activity.style.backgroundColor = "green";
            audio_container.appendChild(audio_activity);

            // generate the audio component and connect the peer stream to it as source
            audio.srcObject = remoteStream;
            audio.autoplay = true;
            audio.controls = true;
            audio_container.appendChild(audio);

            // generate the audio level component to show custom stream levels/volume UI
            audio_level.setAttribute('class','audio-level');
            audio_level.setAttribute('type','range');
            audio_level.setAttribute('min','0');
            audio_level.setAttribute('max','90');
            audio_level.setAttribute('value','1');
            audio_container.appendChild(audio_level);

            // generate a small circle to show volume threshold
            audio_vol_threshold.setAttribute('class','audio-threshold');
            audio_container.appendChild(audio_vol_threshold);

            // add the container component to the list of audios 
            document.getElementById('audio-container').appendChild(audio_container);
            audio_container.setAttribute('class','custom-audio-controls');
            audio_container.setAttribute('id', senderId + '-audio-controls');

            // add the custom volume visualizer handler
            process_audio(audio.srcObject, audio, audio_level, audio_vol_threshold);
        };

        // Handle connections/disconnections from sender
        // Green for connected, Yellow of checking, and Red for disconnected or failed
        peerConnection.oniceconnectionstatechange = () => {
            if (peerConnection.iceConnectionState === "connected") {
                document.getElementById(senderId + '-audio-controls').classList.remove("audio-inactive");
                document.getElementById(senderId + '-audio-controls').getElementsByClassName("audio-threshold")[0].style.backgroundColor = "green";
            }
            else if (peerConnection.iceConnectionState === "checking") {
                document.getElementById(senderId + '-audio-controls').getElementsByClassName("audio-threshold")[0].style.backgroundColor = "yellow";
            }
            else if (peerConnection.iceConnectionState === "disconnected" || 
                peerConnection.iceConnectionState === "failed" ||
                peerConnection.iceConnectionState === "closed") {
                    // add a class which can help hide this audio if needed
                    document.getElementById(senderId + '-audio-controls').classList.add("audio-inactive");
                    document.getElementById(senderId + '-audio-controls').getElementsByClassName("audio-threshold")[0].style.backgroundColor = "red";
            }
        };

        // Set remote description and send answer to the sender
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('answer', { answer, remoteSenderID: senderId });

    });

    // Handle any open connection requests sent by the sender
    socket.on('candidate', ({ candidate, senderId }) => {
        // check if a variable has been made for this sender in the connection list before adding candidate
        const peerConnection = peerConnections[senderId];
        if (peerConnection) {
            peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
    });

    // Handle when this page is closes - equivalent to closing stream
    window.addEventListener('beforeunload', function(event) {
        navigator.sendBeacon("/receiver_disconnect");
    });
    
}

// this function processes audio to make any needed custom UI visual elements
function process_audio(stream_source, audio, audio_level, audio_vol_threshold){
    
    // Define an audio context which will help make the mixer visualization
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 128; // Lower values give a smoother visualization
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    // connect the audio source to the analyzer
    const source = audioContext.createMediaStreamSource(stream_source);
    source.connect(analyser);
    
    // call the visualizer functiona for the actual cumtomized UI
    visualize(analyser,dataArray, audio, audio_level, audio_vol_threshold);
}

// makes the custom audio levels for each audio connected
function visualize(analyser, dataArray, audio, audio_level, audio_vol_threshold) {

    requestAnimationFrame(() => visualize(analyser,dataArray, audio, audio_level, audio_vol_threshold));
    analyser.getByteTimeDomainData(dataArray);

    // Compute volume level (RMS - Root Mean Square)
    // compresses the whole wave into one value to represent loudness
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        sum += Math.pow(dataArray[i] - 128, 2);  // Normalize around 128
    }
    let stream_volume = Math.sqrt(sum / dataArray.length) * audio.volume;  // RMS value
   
    // assign the slider with the volume value
    audio_level.value = stream_volume.toFixed(0);
    if (stream_volume>64){
        audio_vol_threshold.style.backgroundColor = "red";
    }
    else if(stream_volume>45){
        audio_vol_threshold.style.backgroundColor = "orange";
    }
    else{
        audio_vol_threshold.style.backgroundColor = "#bbb";
    }
}

// hide/unhide any streams whos ice connections have been failed or disconnected to remove clutter
function hideInactiveStreams(input_selection){
    
    // get all the inactive audio divs
    const inactives = document.getElementsByClassName("audio-inactive");

    // depending on check selection add and remove the class with right display CSS
    if(input_selection.checked){
        for(let i=0; i<inactives.length; i++){
            inactives[i].classList.add("audio-inactive-off");
            inactives[i].classList.remove("custom-audio-controls");
        }
    }
    else{
        for(let i=0; i<inactives.length; i++){
            inactives[i].classList.remove("audio-inactive-off");
            inactives[i].classList.add("custom-audio-controls");
        }
    }
    
}