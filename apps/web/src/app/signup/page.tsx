'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function SignupPage(): React.ReactElement {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('As senhas não coincidem.')
      return
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signUp({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">🐋</div>
          SmartWhale
        </div>

        <h1 className="auth-title">Criar conta grátis</h1>
        <p className="auth-subtitle">Comece a rastrear smart money em menos de 1 minuto</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && (
            <div className="auth-error">
              <span>⚠</span>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="auth-success">
              <span>✓</span>
              <span>
                Conta criada! Verifique seu e-mail para confirmar o cadastro e acessar o
                dashboard.
              </span>
            </div>
          )}

          {!success && (
            <>
              <div className="auth-field">
                <label className="auth-label" htmlFor="email">
                  E-mail
                </label>
                <input
                  id="email"
                  className="auth-input"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="auth-field">
                <label className="auth-label" htmlFor="password">
                  Senha
                </label>
                <input
                  id="password"
                  className="auth-input"
                  type="password"
                  placeholder="mín. 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>

              <div className="auth-field">
                <label className="auth-label" htmlFor="confirm">
                  Confirmar senha
                </label>
                <input
                  id="confirm"
                  className="auth-input"
                  type="password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>

              <button className="auth-submit" type="submit" disabled={loading}>
                {loading ? 'Criando conta...' : 'Criar conta grátis'}
              </button>
            </>
          )}
        </form>

        <div className="auth-footer">
          Já tem conta?{' '}
          <a href="/login">Entrar</a>
        </div>
      </div>
    </main>
  )
}
