import '@testing-library/jest-dom/vitest';

// jsdom does not implement scrolling; the router resets scroll on navigation.
window.scrollTo = () => {};
