# encgen
Random Encounter Table Generator

JavaScript / HTML application for generating random encounter tables from a JSON data set.

Includes a simple Data Editor for creating and managing the JSON data.

How to Use
==========

Initial Setup
-------------
Simply copy the contents of the /public_html folder to somewhere on your computer.

The application can run in a modern browser, no server required.

Using the Editor
----------------
1. Open editor.html in a modern web browser
2. Import the sample categories and/or filters from the /extra folder or create your own
3. Create your encounter list
4. Export and copy the text
5. Paste the text in your favorite text editor and save a copy for later

Generating Random Tables
------------------------
1. Open generator.html
2. Paste the JSON data from the Editor into the text box
3. Click Import
4. Start generating encounter tables

Importing from a Spreadsheet
----------------------------
For this, you will need the ability to write a script to take CSV input and output it as JSON in the format expected by this application.

Please see the /extra/sample_combined.json for an example of the expected format.

There is also a sample script, /extra/converter.php, that converts a spreadsheet I had on hand for HackMaster 5e, written in PHP, that may serve as a starting point.

Once your data is converted to the correct JSON format, you should be able to import and use it as described above.
