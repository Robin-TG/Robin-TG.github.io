# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a simple web-based chat interface called "Green Sieve" that allows users to send text messages and upload images. The application consists of three main files:
- `index.html` - The HTML structure with chat interface elements
- `app.js` - JavaScript for handling user interactions and chat functionality
- `styles.css` - CSS for styling the chat interface

## Code Architecture

The application follows a straightforward client-side architecture with:
- HTML for structure and content
- CSS for styling and responsive design
- JavaScript for interactivity and user experience

The JavaScript handles:
- Sending messages when the user presses Enter or clicks Send
- Displaying messages in the chat history
- Image upload functionality (though the implementation appears incomplete in app.js)
- Basic UI interactions

## Development Setup

This is a static HTML/CSS/JavaScript application with no build process required. To run:

1. Open `index.html` in a web browser
2. The application will work out of the box with no additional dependencies

## Key Files

- `index.html`: Main HTML structure with chat interface elements
- `app.js`: JavaScript logic for chat functionality
- `styles.css`: Styling for the chat interface

## Common Tasks

- Adding new features to the chat interface
- Improving the user experience
- Adding new UI elements or interactions
- Enhancing the styling
- Implementing missing image upload functionality in app.js

## Notes

The application appears to be a basic chat interface with some incomplete functionality (particularly around image handling in app.js). The JavaScript file references elements that don't exist in the HTML (like `image-upload` and `image-preview`), suggesting that the implementation may be incomplete or that these elements were removed or renamed.