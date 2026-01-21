var socket = io.connect(window.location.origin);

// global mic activateion flag and info flag
let micActive = false;
let websiteInfoMore = true;

// a function to update the mic infoprmation UI during connection/disconnection
function updateMicInfo(){
    if (micActive){
        // change the mic icon and info to show that audio is being tranfer
        document.getElementById('MicIcon').setAttribute('src','static/img/mic_icon_on.png');
        document.getElementById('MicInfo').innerHTML = 'Your microphone is ON';
        document.getElementById('micLevels').style.display = '';
    } else {
        // change the mic icon and info to show that audio is being tranfer
        document.getElementById('MicIcon').setAttribute('src','static/img/mic_icon_off.png');
        document.getElementById('MicInfo').innerHTML = 'Your microphone is OFF';
        document.getElementById('micLevels').style.display = 'none';
    }
}

// Random message generator for each used on Arrival
function generate_welcomeMsg(){
    
    // List of messages whihc can be shown to the user
    const welcomeMsgs = [
        'here/there',
        'you are remote',
        'miles of line'
    ];

    let msg_len = welcomeMsgs.length;
    let rand_msg;

    // generate a random number
    rand_msg = welcomeMsgs[Math.floor(Math.random()*msg_len)];
    // update the welcome text with random number
    document.getElementById('sender_welcome').innerHTML = rand_msg;

}

// flip the website info visibility when more or less info button is clicked
function hideUnhideWebsiteInfo(){
    
    // flip the flag
    websiteInfoMore = !websiteInfoMore;
    // get list of all info to hide or unhide
    const moreInfoList = document.getElementsByClassName("more-websiteInfo");

    // depending on the flag - change info text and hide/unhide instructions
    if (websiteInfoMore){
        document.getElementById('websiteInfoMoreButton').innerHTML = "<u>(more info)</u>";
        for(let i=0; i<moreInfoList.length; i++){
            // this class has a display none porperty
            moreInfoList[i].classList.add("audio-inactive-off");
        }
    } else {
        document.getElementById('websiteInfoMoreButton').innerHTML = "<u>(less info)</u>";
        for(let i=0; i<moreInfoList.length; i++){
            moreInfoList[i].classList.remove("audio-inactive-off");
        }
    }

}

// bundling together all functions to be called when loading the UI
function setupSenderUI(){
    generate_welcomeMsg();
    updateMicInfo();
}

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

// any audio effects to be added to audio
const aud_effect_constraints = {
    echoCancellation : false
};


// When user clicks the mic icon
async function sendAudioStream() {
    // setup a variable to access the default mic of the device
    let stream;

    // get the NAT/STUn/TURN server config from the server
    const rtcConfig = await fetchIceConfig();
        
    // catch any error is user's mic was not accessible
    try{
        stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
    }
    catch
    {
        console.log("Mic Permission dismissed");
        return;
    }    
    
    // make a p2p connection
    const peerConnection = new RTCPeerConnection(rtcConfig);
    
    out_stream = setupAudioVisulizer(stream);  
    // apply custom setting to each mic track and add it to the p2p connection
    out_stream.stream.getTracks().forEach(track => {
        track.applyConstraints(aud_effect_constraints);
        peerConnection.addTrack(track, out_stream.stream);
    });          
    
    // this helps the user to send all their puclic access points while declaring themselves as 
    // an ICE candidate over the network to everyone
    // sender also sends personal ID to recognize any open communication from the receiver
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            socket.emit('candidate', { candidate: event.candidate, senderId: socket.id });
        }
    };

    // create an offer which will be send to the receiver, while waiting for an 'answer'
    // which helps to confirm that the connection has been made
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('offer', {offer, senderId: socket.id });

    // update mic info as it is being used to send audio now
    micActive = true;
    updateMicInfo();
    
    // define what to do when an 'answer' is available on the open network
    socket.on('answer', async ({ answer, remoteSenderID }) => {
        // remote ID is checked so that only answer for sender's offer are entertained
        // all other senders also have their answers which can be ignored with this check
        if(remoteSenderID == socket.id){
            // Set the remote description with the answer received from the receiver
            await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        }
    });

    // Receiver also exposes their ICE candidate info to make a proper p2p connection
    // this handles to review only connection details for current sender before finalizing the connection
    socket.on('candidateRec', ({ candidate, originalSenderId }) => {
        if (originalSenderId == socket.id) {
            peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
    });

    // when receiver closes the stream, this helps to handle any local disconnections
    socket.on('byeBye', (event) => {
        peerConnection.close();
        
        // update mic info
        micActive = false;
        updateMicInfo();
    });

}

let gainNode;
function setupAudioVisulizer(micInput){

    // Define an audio context which will help make the mixer visualization
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256; // Lower values give a smoother visualization
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const destination = audioContext.createMediaStreamDestination();

    // Creating a compressor to address any loud and low sounds
    const compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-20, audioContext.currentTime); // in dB
    compressor.ratio.setValueAtTime(10, audioContext.currentTime); // ratio of 12:1
    compressor.attack.setValueAtTime(0.1, audioContext.currentTime);
    compressor.release.setValueAtTime(2, audioContext.currentTime);
    
    // Creating a gain control to increase volume after the compression
    gainNode = audioContext.createGain();

    // connect the audio source to the analyzer
    const source = audioContext.createMediaStreamSource(micInput);
    source.connect(compressor);
    compressor.connect(gainNode);
    gainNode.connect(analyser);
    gainNode.connect(destination);

    showAudioLevels(analyser, dataArray);

    return destination
}

function showAudioLevels(analyser, dataArray){    

    requestAnimationFrame(() => showAudioLevels(analyser,dataArray));
    analyser.getByteTimeDomainData(dataArray);    

    // Compute volume level (RMS - Root Mean Square)
    // compresses the whole wave into one value to represent loudness
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        sum += Math.pow(dataArray[i] - 128, 2);  // Normalize around 128
    }
    let stream_volume = Math.sqrt(sum / dataArray.length);  // RMS value
    stream_volume = 20*Math.log10(Math.max(stream_volume, 1) / 127);

    // Clamp to desired range for display
    const MIN_DB = -45  ;
    const MAX_DB = 0;
    stream_volume = Math.max(MIN_DB, Math.min(MAX_DB, stream_volume));
    finalDb = (stream_volume-MIN_DB)*(150/(MAX_DB-MIN_DB));

    // move the meter height
    document.getElementById("meterMic").style.height = 150-finalDb;

    // update dynamic gain
    const MIN_DGain = 0.8;
    const MAX_DBGain = 1.5;
    if(stream_volume<-20){
        gainNode.gain.value = stream_volume*(MAX_DBGain/-40);
    }
    else if(stream_volume>-10){
        gainNode.gain.value = MIN_DGain + stream_volume/(-10);
    }
    else{
        gainNode.gain.value = 1;
    }
    console.log(stream_volume, gainNode.gain.value);
}