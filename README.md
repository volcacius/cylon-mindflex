# Cylon.js For Neurosky powered Mindflex

Cylon.js (http://cylonjs.com) is a JavaScript framework for robotics, physical computing, and the Internet of Things (IoT).

This repository contains the Cylon.js adaptor/driver for the Neurosky powered Mindflex, augmented with BT serial output as illustrated here http://www.instructables.com/id/Mindflex-EEG-with-raw-data-over-Bluetooth/.
This repository is a fork of the cylon-neurosky module. which supports only the Mindwave. Compared to the Mindwave, the Mindflex starts in mode 0x00, meaning it's on baud 9600 and doesn't output raw wave data. 
This fork add 3 features:
- Switch the Mindflex from mode 0x00 to mode 0x02, i.e. baud 57600 with raw wave data output.
- Packet checksum support, i.e. compute the checksum and compare it with the one received from the Mindflex.
- Improve buffer unalligned data managment, i.e. retain the partial data until a complete packet is received.

## Credits

   All the credits goes to the Hybrid Group for creating and mantaining Cylon.js and the cylon-neurosky module. 

## How to Use

This example displays the Attention and Meditation data reading sent by the Mindflex Headset:

```javascript
var Cylon = require('cylon');

Cylon.robot({
  connections: {
    neurosky: { adaptor: 'mindflex', port: '/dev/rfcomm0' }
  },

  devices: {
    headset: { driver: 'mindflex' }
  },

  work: function(my) {
    my.headset.on('attention', function(data) {
      Logger.info("attention:" + data);
    });

    my.headset.on('meditation', function(data) {
      Logger.info("meditation:" + data);
    });
  }
}).start();
```

## How to Connect

### OSX

In order to allow Cylon.js running on your Mac to access the Mindwave, go to "Bluetooth > Open Bluetooth Preferences > Sharing Setup" and make sure that "Bluetooth Sharing" is checked.

### Ubuntu

Connecting to the Mindwave from Ubuntu or any other Linux-based OS can be done entirely from the command line using [Gort](http://gort.io) commands.
Here are the steps:

Find the address of the Mindwave, by using:

    $ gort scan bluetooth

Pair to Mindwave using this command (substituting the actual address of your Mindwave):

    $ gort bluetooth pair <address>

Connect to the Mindwave using this command (substituting the actual address of your Mindwave):

    $ gort bluetooth connect <address>

### Windows

You should be able to pair your Mindwave using your normal system tray applet for Bluetooth, and then connect to the COM port that is bound to the device, such as `COM3`.
