import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { WalletProvider } from './context/Wallet.jsx'
import { WinProvider } from './components/WinBanner.jsx'
import App from './App.jsx'
import './styles.css'
createRoot(document.getElementById('root')).render(
  <BrowserRouter><WalletProvider><WinProvider><App /></WinProvider></WalletProvider></BrowserRouter>)
