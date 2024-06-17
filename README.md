# Banner to Google Calendar

This is a Web Extension made to automatically export the entries of the schedule on banner.aus.edu to Google Calendar.

## Usage

To use the extension you need to be under **Student Schedule by Day and Time**, then click on the extension icon, then name the calendar that will be exported to Google Calendar.

Disclaimer: you might have to login in using your Google account when using the program for the first time in order to obtain oauth2 access token since the program uses the Chrome identity API.

![image](https://github.com/yousefbilal/Banner-to-Google-Calendar/assets/50619491/1b8dfe69-009c-47f3-967f-d8f337fc199a)
![image](https://github.com/yousefbilal/Banner-to-Google-Calendar/assets/50619491/1728773e-f2dc-4e8c-80c6-d39dd9830c9b)

## Building the extension

Since Manifest V3, Web extensions can't import scripts from CDNs directly into the extension, and hence using a bundler is required for importing external scripts. The only package used in this project is `moment.js` for date/time formatting. 

NPM is used in this project and the dependencies are listed under `package.json`. They can be installed using the command:
```console
npm install
```

The bundler I used for this project is [parcel](https://github.com/parcel-bundler/parcel); however, any other bundler can be used. The development dependencies can be installed using:
```console
npm install --also=dev
```

The build scripts are already inside `package.json`. The `build:test` script is bundled without optimization and was used for testing and debugging. The built program will be under `dist/`. 

```console
npm run build
# OR
npm run build:test
```

In case of using other bundlers, you have the option of writing the build scripts insider `package.json`:

```json
"scripts": {
  "build": // WRITE BUILD SCRIPT HERE
}
```

and run it using:

```console
npm run build
```

## Loading the extension

In order to load the extension into the browser, go to `Manage extensions` in your browser. Make sure that developer mode is enable and then `Load unpacked` option will appear. Click on `Load unpacked` and select the directory that contains the built extension (build instructions above)
