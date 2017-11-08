"use strict";
const Homey = require('homey');
const http = require("http");
const fs = require("fs");
const request = require("request");
const archiver = require('archiver');
const nodemailer = require('nodemailer');

var stopDate = new Date();
var dir = 'userdata';
//var mail_user, mail_pass, mail_host, mail_port, mail_from, mail_secure, use_credentials;

var timeDuration;
var intervalSec;
var localIpAdress;
var portNumber;
var command;
var requestparams;

var mailhostname;
var mailport;
var mailsecure;
var mailuserfromadress;
var mailuserpass;
var mailTo;
var mailSubject;
var mailText;
var startSnapShots; 
var fileNames =[];

var output;
var archive;

class TakeSnapShotsAndMail extends Homey.App {
	
	onInit() {
		
		this.log('MyApp is running...');
    init();
    
    Homey.ManagerSettings.on('set', function(){init()});
    this.takesnapshotssendmail = new Homey.FlowCardAction('takesnapshotssendmail');
    
        this.takesnapshotssendmail
          .register()
          .on('run', (args, state, callback) => {
            var intervalID = 3;
            archive = archiver('zip');
            
            archive.on('error', function(err){
              throw err;
            }); 

            output = fs.createWriteStream('userdata/photos.zip');
            
            output.on('close', function () {
              console.log(archive.pointer() + ' total bytes');
            });
            
            var wait =
                ms => new Promise(
                    r => setTimeout(r, ms)
                );
             
            var repeat =
                (ms, func) => new Promise(
                    r => (
                        intervalID = setInterval(func, ms),
                        wait(ms).then(r)
                    )
                );
            var stopAfterXSecs =
                () => new Promise(
                    r => r(setTimeout(
                        () => {
                            clearInterval(intervalID);
                              archive.pipe(output);
                              archive.finalize();
                              sendMail();
                        }, 60000)
                    )
                );

            repeat(3000, () => Promise.all([snapshots()]))
                .then(stopAfterXSecs())  // starts timer to end repetitions
                .then(console.log('repeat start')); // informs that all actions were started correctly and we are waiting for them to finish
            
          });
	
  }
}

function init() {
	//load settings
	timeDuration = Homey.ManagerSettings.get('timeDuration');
  intervalSec = Homey.ManagerSettings.get('intervalSec');
	localIpAdress = Homey.ManagerSettings.get('localIpAdress');
	portNumber = Homey.ManagerSettings.get('portNumber');
	command = Homey.ManagerSettings.get('webcamCommand');
	requestparams = Homey.ManagerSettings.get('additionalParams');
	
	mailhostname = Homey.ManagerSettings.get('mailHostname');
	mailport = Homey.ManagerSettings.get('mailPort');
	mailsecure = Homey.ManagerSettings.get('mailSecure');
	mailuserfromadress = Homey.ManagerSettings.get('mailFromAdress');
	mailuserpass = Homey.ManagerSettings.get('mailPassword');
	mailTo = Homey.ManagerSettings.get('mailToAdress');
	mailSubject = Homey.ManagerSettings.get('mailSubject');
	mailText = Homey.ManagerSettings.get('mailText');

  console.log(timeDuration +" " +localIpAdress)
	console.log('Backend settings updated');
}

var snapshots = function()
{
  fileNames = [];
       var currentDate = new Date();
                console.log("takesnapshot");
                  var minutes = currentDate.getMinutes();
                  var seconds = currentDate.getSeconds();
   
                  var plaatjeNaam = `plaatje${minutes}${seconds}.jpg`;
                  var file_url =`http://${localIpAdress}:${portNumber}${command}${requestparams}`;
                  console.log(file_url);

                  fileNames.push(plaatjeNaam);        
                  console.log("plaatje : " + plaatjeNaam)
                  archive.append(request.get(file_url), { name: plaatjeNaam});
}

var deleteFolderRecursive = function(path) {
console.log("delete files")
  if( fs.existsSync(path) ) {
    fs.readdirSync(path).forEach(function(file,index){
      var curPath = path + "/" + file;
      console.log(curPath);
      if(fs.lstatSync(curPath).isDirectory()) { // recurse
        deleteFolderRecursive(curPath);
      } else { // delete file
        fs.unlinkSync(curPath);
        console.log(curPath);
        // einde
        return Promise.resolve(true);
      }
    });
    //fs.rmdirSync(path);
  }
};

var sendMail = function()
{
  console.log("send mail")
  const trans = nodemailer.createTransport({
      host: mailhostname, // hostname
      port: mailport, // secure:true for port 465, secure:false for port 587
      secure: mailsecure, // port for secure SMTP
      auth: {
        user: mailuserfromadress,
        pass: mailuserpass
      }
  });

  let mail_op ={
    from: mailuserfromadress,
    to: mailTo,
    subject: mailSubject,
    html: mailText,
    attachments: [
      { //using a local file
        path: 'userdata/photos.zip'
      }
    ]
  };

  trans.sendMail(mail_op, (err, info)=>{
    if(err){
      console.log(err);
    } else {
      console.log('Email sent: ' + info.response);
      deleteFolderRecursive(dir);
    }
  });
}

module.exports = TakeSnapShotsAndMail;