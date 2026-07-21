# Petrol Share

Petrol share is a web app that runs fully locally on the vistor's browser that helps to find the cost for petrol each person in a car has to pay.

## Challenge

A car went from point A to B to C and back the same way. Some people were in the car throughout the journey from A to B to C to B to A. Some people were only in for B to C to B. Some people were only in for A to B to C. This app will solve the problem of finding how much it cost in fuel for each person for their part of the whole trip.

## Design

### Overall

- Not a multistep form. An interactive web app.

### Trip Design

- The user should be able to set points (A,B,C in this document, but full names in the actual design).
- The user needs to be able to design a trip with these points, the distance between each point will be considered the leg.

### People Management

- The user needs to be able to add people to the trip.
- The user needs to be able to assign people to certain legs of the trip.

### Cost management

- The user needs to be able to provide the average fuel economy for the whole trip (kmpl).
- The user needs to be able to provide the fuel cost per litre.

### Output

The user will be able to see the following

- Total distance travelled
- Total petrol cost of the journey
- Total petrol spent in litres.
- Per person split of distance travelled.
- Per person split of legs they were part of.
- Per person split of petrol cost.

## Tech Stack

- React 19 with vite framework
- Typescript for types.
- Tailwindcss for styling
- Zod for validation
- Indexeddb for storage and persistence
- PWA with offline access. Needs to be able to install locally on iOS and Android devices.
- Vitest test suites for the calculation engine and UI.

## Deployment

- Github pages on push to main.
- CI job for unit tests.

