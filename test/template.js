console.log("template.js");
import Speech from "./node_modules/speak-tts/lib/speak-tts.js"
const speech = new Speech();

document.addEventListener("DOMContentLoaded", function(event) {

    speech.init({
        // 'volume': 1,
        // 'lang': 'en-GB',
        'rate': 1,
        // 'pitch': 1,
        // 'voice':'Google UK English Male',
        'splitSentences': false,
        }).then((data) => {
        // The "data" object contains the list of available voices and the voice synthesis params
        document.getElementById("welcome").innerText = "Speech is ready - voices are available";

        let listbox = document.getElementById("ttsengines");

        for(let voice of data.voices)
        {
            let option = document.createElement("option");
            option.innerText = voice.name;
            option.value = voice.name;
            listbox.appendChild(option);
        }


        console.log("Speech is ready, voices are available", data)

    }).catch(e => {
        console.error("An error occurred while initializing : ", e)
    });


    // do work
    document.getElementById("btnspeak").addEventListener('click', speak);
});

function speak(event) {
    let text = document.getElementById("textspeech").value;
    let voice = document.getElementById("ttsengines").value;
    // Speech.setLanguage('en-US')
    speech.setVoice(voice);
    speech.speak({
        text: text,
        queue: false, // current speech will be interrupted
        listeners: {
            onstart: () => {
                console.log("Start utterance")
            },
            onend: () => {
                console.log("End utterance")
            },
            onresume: () => {
                console.log("Resume utterance")
            },
            onboundary: (event) => {
                console.log(event.name + ' boundary reached after ' + event.elapsedTime + ' milliseconds.')
            }
        }
    }).then(() => {
        console.log("Success !")
    }).catch(e => {
        console.error("An error occurred :", e)
    })
}

function testFunc() {
    // some lines here
}
