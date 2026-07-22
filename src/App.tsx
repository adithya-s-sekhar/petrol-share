import { AppPage } from './app/AppPage'
import { ThemeProvider } from './app/theme/ThemeProvider'

function App() {
  return <ThemeProvider><AppPage /></ThemeProvider>
}

export default App
