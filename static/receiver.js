var socket = io.connect(window.location.origin);

let peerConnections = {}; // Store peer connections keyed by socket ID

// STUN Server for NAT traversal
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
    
    const rtcConfig = await fetchIceConfig();
    console.log(rtcConfig);

    // update the stream activity info
    document.getElementById('streamActiveInfoStatus').innerHTML = "ACTIVE"
    document.getElementById('streamActiveInfoStatus').style.color = "green";

    socket.on('offer', async ({ offer, senderId }) => {

        console.log('O0 - Offer recived');

        // check if this senderID already exists, and if yes, do not add audio controls for it
        if (peerConnections[senderId]){
            console.log('sender already connected');
            return;
        }

        // cretae a new peer connection
        const peerConnection = new RTCPeerConnection(rtcConfig);
        peerConnections[senderId] = peerConnection;

        console.log('O1 - Peerconnection var made and added to list of connections');
        
        // check for ice errors
        peerConnection.onicecandidateerror = (event) => {
            console.error("ICE Candidate Error:", event);
        };

        // Send ICE candidates to the sender
        peerConnection.onicecandidate = event => {
            if (event.candidate) {
                console.log("New ICE candidate:", event.candidate.candidate,senderId);
                socket.emit('candidateRec', { candidate: event.candidate, originalSenderId: senderId });
            }
        };

        // Handle incoming audio stream and convert to UI element
        peerConnection.ontrack = event => {
            
            // make HTML components to be added
            const audio_container = document.createElement('div');
            const audio_level = document.createElement('input');
            const audio_num = document.createElement('span');
            const audio_activity = document.createElement('span');
            const audio_vol_threshold = document.createElement('span');
            const audio = document.createElement('audio');
            const remoteStream = event.streams[0];
            console.log(event.streams);
            
            // add a number to the audio
            audio_num.innerHTML = Object.keys(peerConnections).length;
            audio_num.setAttribute('class','audio-number');
            audio_container.appendChild(audio_num);

            // add an audio activity circle
            audio_activity.setAttribute('class','audio-threshold');
            audio_activity.style.backgroundColor = "green";
            audio_container.appendChild(audio_activity);

            // generate the audio component and connect the peer stream to it
            audio.srcObject = remoteStream;
            audio.autoplay = true;
            audio.controls = true;
            audio_container.appendChild(audio);

            // generate the audio level component to show stream volumne
            audio_level.setAttribute('class','audio-level');
            audio_level.setAttribute('type','range');
            audio_level.setAttribute('min','0');
            audio_level.setAttribute('max','127');
            audio_level.setAttribute('value','1');
            audio_container.appendChild(audio_level);

            // generate a small circle to show volume threshold
            audio_vol_threshold.setAttribute('class','audio-threshold');
            audio_container.appendChild(audio_vol_threshold);

            // add the container component to the list of audios
            document.getElementById('audio-container').appendChild(audio_container);
            audio_container.setAttribute('class','custom-audio-controls');
            audio_container.setAttribute('id',senderId + '-audio-controls');

            // add the visualizer element
            process_audio(audio.srcObject, audio, audio_level, audio_vol_threshold);
        };

        // Handle connections/disconnections from sender
        peerConnection.oniceconnectionstatechange = () => {
            console.log("ICE Connection for " + senderId + ":", peerConnection.iceConnectionState);
            if (peerConnection.iceConnectionState === "connected") {
                document.getElementById(senderId + '-audio-controls').getElementsByClassName("audio-threshold")[0].style.backgroundColor = "green";
            }
            else if (peerConnection.iceConnectionState === "checking") {
                document.getElementById(senderId + '-audio-controls').getElementsByClassName("audio-threshold")[0].style.backgroundColor = "yellow";
            }
            else if (peerConnection.iceConnectionState === "disconnected" || 
                peerConnection.iceConnectionState === "failed" ||
                peerConnection.iceConnectionState === "closed") {
                    document.getElementById(senderId + '-audio-controls').classList.add("audio-inactive");
                    document.getElementById(senderId + '-audio-controls').getElementsByClassName("audio-threshold")[0].style.backgroundColor = "red";
            }
        };

        // Set remote description and send answer
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        console.log('02 - Pre answer: ' + senderId);
        socket.emit('answer', { answer, remoteSenderID: senderId });
        console.log('O3 - Answer socket emmited back to sender recived');

    });

    // Handle incoming ICE candidates
    socket.on('candidate', ({ candidate, senderId }) => {
        const peerConnection = peerConnections[senderId];
        console.log("ON_CANDI", candidate.candidate, senderId)
        if (peerConnection) {
            peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
    });

    // Handle when this page is closes - equivalent to closing stream
    window.addEventListener('beforeunload', function(event) {
        navigator.sendBeacon("/receiver_disconnect");
    });
    
}

function process_audio(stream_source, audio, audio_level, audio_vol_threshold){
    // Define an audio context for the mixer visualization
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256; // Lower values give a smoother visualization
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    const source = audioContext.createMediaStreamSource(stream_source);
    source.connect(analyser);
    
    visualize(analyser,dataArray, audio, audio_level, audio_vol_threshold);
}

function visualize(analyser, dataArray, audio, audio_level, audio_vol_threshold) {

    requestAnimationFrame(() => visualize(analyser,dataArray, audio, audio_level, audio_vol_threshold));
    analyser.getByteTimeDomainData(dataArray);

    // const slider_temp = document.getElementById("test-slide");

    // Compute volume level (RMS - Root Mean Square)
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        sum += Math.pow(dataArray[i] - 128, 2);  // Normalize around 128
    }
    let stream_volume = Math.sqrt(sum / dataArray.length) * audio.volume;  // RMS value
   
    // assign the slider with the volume value
    audio_level.value = stream_volume.toFixed(0);
    if (stream_volume>80){
        audio_vol_threshold.style.backgroundColor = "red";
    }
    else if(stream_volume>60){
        audio_vol_threshold.style.backgroundColor = "orange";
    }
    else{
        audio_vol_threshold.style.backgroundColor = "#bbb";
    }
}

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