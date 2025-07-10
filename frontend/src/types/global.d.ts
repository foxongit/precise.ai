// Global type declarations

// Add custom properties to Window interface
interface Window {
  scrollTimeout: ReturnType<typeof setTimeout>;
}
