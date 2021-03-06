const personalData = require('./personalData');
const webModel = require('./webModel');
const webModelFunctions = require('./webModelFunctions');
const tts = require('./tts');
var robotModel = require('./robotModel');
// Set last movement to now to initiate the idle timer
robotModel.lastMovementTime = Date.now();
const ROSLIB = require('roslib');
var unplug; // Empty global for actual topic

// Copied from arloweb.js
var connectedToROS = false, // Track my opinion of the connection
    ros, // Empty global for actual connection.
    longDelay = personalData.rosLibDelay * 1000;

// Define a list of ROS Parameters to monitor
// NOTE: Add an instance to webModel if you want this sent to the web app!
var rosParameters = {
    ignoreCliffSensors: {
        param: null,
        label: 'ignoreCliffSensors',
        path: '/arlobot/ignoreCliffSensors'
    },
    ignoreProximity: {
        param: null,
        label: 'ignoreProximity',
        path: '/arlobot/ignoreProximity'
    },
    ignoreIRSensors: {
        param: null,
        label: 'ignoreIRSensors',
        path: '/arlobot/ignoreIRSensors'
    },
    ignoreFloorSensors: {
        param: null,
        label: 'ignoreFloorSensors',
        path: '/arlobot/ignoreFloorSensors'
    },
    monitorACconnection: {
        param: null,
        label: 'monitorACconnection',
        path: '/arlobot/monitorACconnection'
    },
    mapName: {
        param: null,
        label: 'mapName',
        path: '/arlobot/mapname'
    },
    explorePaused: {
        param: null,
        label: 'explorePaused',
        path: '/arlobot_explore/pause'
    }
};

var unplugRobot = function (value) {
    var unplugRequest = new ROSLIB.ServiceRequest({
        // args from rosservice info <service>
        unPlug: value // Note javaScript uses true not True for bool
    });
    unplug.callService(unplugRequest, function (result) {
        console.log(result);
        webModelFunctions.scrollingStatusUpdate(result);
    })
};

var talkToROS = function () {
    // If you wanted to dump ALL params:
    //ros.getParams(function(params) {
    //    console.log('ROSLIB Params:');
    //    console.log(params);
    //});

    // Start subscriptions:
    // Each topic function will do its own checking to see if the topic is live or not.
    setTimeout(subscribeToActiveStatus, longDelay); // Start with a slight delay

    // Set up services to use
    unplug = new ROSLIB.Service({
        ros: ros,
        name: '/arlobot_unplug', // rosservice list
        serviceType: 'arlobot_msgs/UnPlug' // rosservice info <service>
    });

    // Enumerate parameters to watch
    for (var prop in rosParameters) {
        rosParameters[prop].param = new ROSLIB.Param({
            ros: ros,
            name: rosParameters[prop].path
        });
    }
    // and poll them.
    pollParams();
};

var pollParams = function () {
    function checkParameter(prop) {
        rosParameters[prop].param.get(function (value) {
            //console.log(rosParameters[prop].label + ': ' + value);
            // Assign state to webModel object for view by web page.
            if (webModel.rosParameters.hasOwnProperty(prop)) {
                webModelFunctions.updateRosParameter(prop, value);
                //webModel.rosParameters[prop] = value;
                //console.log('For web: ' + webModel.rosParameters[prop]);
            }
        });
    }

    for (var prop in rosParameters) {
        if (rosParameters.hasOwnProperty(prop)) {
            checkParameter(prop);
        }
    }

    setTimeout(pollParams, longDelay);
};

var setParam = function (paramLabel, value) {
    if (rosParameters.hasOwnProperty(paramLabel)) {
        if (rosParameters[paramLabel].param) {
            rosParameters[paramLabel].param.set(value);
        }
    }
};

var closeDeadROSConnection = function () {
    // TODO: Does this ever happen?
    'use strict';
    console.log("Closing dead ROS connection.");
    if (ros !== undefined) {
        ros.close();
    }
    console.log("CLOSED dead ROS connection!");
};

var subscribeToActiveStatus = function () {
    'use strict';
    // Remember to add new instances to talkToROS() at the end!
    // This should serve as a template for all topic subscriptions
    // Make sure we are still connected.

    // Make sure service exists:
    var closeDeadConnectionTime;
    closeDeadConnectionTime = setTimeout(closeDeadROSConnection, longDelay);
    ros.getTopics(function (result) { // Unfortunately this can stall with no output!
        clearTimeout(closeDeadConnectionTime);

        // THIS is where you put the subscription code:
        var cmd_activeStatus = new ROSLIB.Topic({
            ros: ros,
            name: '/cmd_vel_mux/active', // Obtain name by running 'rostopic list'
            messageType: 'std_msgs/String' // Obtain Type by running 'rostopic info <name>'
        }); // Obtain message.??? by running 'rosmsg show <messageType>'
        cmd_activeStatus.subscribe(function (message) {
            robotModel.active_cmd = message.data;
            console.log('Command Velocity Topic says: ' + message.data);
            if (message.data === 'idle') {
                robotModel.cmdTopicIdle = true;
            } else {
                robotModel.cmdTopicIdle = false;
                robotModel.lastMovementTime = Date.now();
            }
        });

        // THIS is where you put the subscription code:
        var arlobot_arlo_status = new ROSLIB.Topic({
            ros: ros,
            name: '/arlo_status', // Obtain name by running 'rostopic list'
            messageType: 'arlobot_msgs/arloStatus' // Obtain Type by running 'rostopic info <name>'
        }); // Obtain message.??? by running 'rosmsg show <messageType>'
        arlobot_arlo_status.subscribe(function (message) {
            for (let key in message) {
                if (message.hasOwnProperty(key)) {
                    webModelFunctions.updateRosTopicItem(key, message[key]);
                }
            }
        });

        // THIS is where you put the subscription code:
        var arlobot_joystick = new ROSLIB.Topic({
            ros: ros,
            name: '/joy', // Obtain name by running 'rostopic list'
            messageType: 'sensor_msgs/Joy' // Obtain Type by running 'rostopic info <name>'
        }); // Obtain message.??? by running 'rosmsg show <messageType>'
        arlobot_joystick.subscribe(function (message) {
            //console.log(message.buttons);
            // A, B, X, Y, LB, RB, BACK, START, Xbox360, LeftStick, RightStick, Left, Right, Up, Down
            if (message.buttons[0] === 1) {
                tts('Hello, my name is two flower')
            } else if (message.buttons[1] === 1) {
                tts('What is your name?');
            } else if (message.buttons[3] === 1) {
                tts('Nice to meet you.');
            } else if (message.buttons[2] === 1) {
                tts('Excuse me.');
            } else if (message.buttons[5] === 1) {
                tts('~/.arlobot/sounds/readyMaster.wav');
            } else if (message.buttons[11] === 1) {
                tts('~/.arlobot/sounds/Exterminate.wav');
            } else if (message.buttons[12] === 1) {
                tts('~/.arlobot/sounds/input1.wav');
            } else if (message.buttons[13] === 1) {
                tts('~/.arlobot/sounds/affirmative.wav');
            } else if (message.buttons[14] === 1) {
                tts('~/.arlobot/sounds/depressed.wav');
            }
            /*
            for (let key in message) {
                if (message.hasOwnProperty(key)) {
                    webModelFunctions.updateRosTopicItem(key, message[key]);
                }
            }
            */
        });
    });
};

// Copied from arloweb.js
// Be sure to set url to point to localhost,
// and change any references to web objects with console.log (i.e. setActionField)
var pollROS = function () {
    // console.log('ROSLIB pollROS run');
    connectedToROS = false;

    ros = new ROSLIB.Ros({
        url: 'ws://localhost:9090',
        // This eliminates a warning about utf8:
        encoding: 'ascii'
    });

    ros.on('connection', function () {
        webModelFunctions.scrollingStatusUpdate('ROSLIB Websocket connected.');
        // Set last movement to now to initiate the idle timer
        robotModel.lastMovementTime = Date.now();
        //connectRequested = true;
        //updateConnectedButton();
        //checkROSServices();
        setTimeout(talkToROS, longDelay);
    });

    ros.on('error', function (error) {
        //console.log('Error connecting to websocket server: ', error);
        //console.log('ROSLIB Websocket error');
        if (ros !== undefined) {
            ros.close();
        }
        setTimeout(pollROS, longDelay);
    });

    ros.on('close', function () {
        //console.log('Connection to websocket server closed.');
        webModelFunctions.scrollingStatusUpdate('ROSLIB Websocket closed');
        connectedToROS = false;
        //updateConnectedButton();
        setTimeout(pollROS, longDelay);
    });
};

function start() {
    pollROS();
}

exports.start = start;
exports.setParam = setParam;
exports.unplugRobot = unplugRobot;
