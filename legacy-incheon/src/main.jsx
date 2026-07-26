import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

// 주: Leaflet 지도가 React.StrictMode의 dev 이중 마운트와 충돌할 수 있어 StrictMode 미사용
ReactDOM.createRoot(document.getElementById('root')).render(<App />)
