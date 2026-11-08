# Callwell

A responsive, no-build caller-ID-style contact manager and call-history demo. Open `index.html` in a modern browser; no package installation or server is required.

## Features

- Search recent calls, contacts, and blocked numbers
- Browse incoming, outgoing, and missed calls
- Add and remove contacts, with duplicate-number and phone-number validation
- Use the dial pad or call buttons to open the device's phone app via a `tel:` link
- Block and unblock numbers, and label unwanted numbers as spam
- Switch between light and dark themes; your theme choice is saved on this device
- Export and import a versioned JSON backup of your contacts, calls, and blocked numbers
- Clear call history without removing contacts or blocked numbers
- Keep contacts, call history, and preferences in this browser's local storage
- Adapt the interface for mobile and desktop screens

## Privacy and platform limits

Callwell does not upload or look up phone numbers, access the device's contacts, monitor incoming calls, or block calls at the operating-system level. It is a standalone web app: the sample call history is illustrative, and number blocking only affects calls initiated inside this app. Starting a call asks the browser to hand the number to the device's phone app. Browser storage can be cleared using the browser's site-data settings.

Importing a backup replaces the app's saved contacts, call history, and blocked/spam lists after confirmation. Exported backups are plain JSON files; keep them somewhere private.
