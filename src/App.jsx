import React from "react";
import { useState } from "react";
import { supabase } from "./supabase";

export default function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  async function login(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      setError("Adresse e-mail ou mot de passe incorrect.");
      setLoading(false);
      return;
    }

    const { data: profileData, error: profileError } =
      await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", data.user.id)
        .single();

    if (profileError) {
      setError("Impossible de récupérer votre profil.");
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    setUser(data.user);
    setProfile(profileData);
    setLoading(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setEmail("");
    setPassword("");
  }

  return (
    <main className="app">
      <section className="login-card">
        <div className="logo">É</div>
        <h1>ÉvalClasse Live</h1>
        <p className="subtitle">
          La plateforme interactive d'évaluation des présentations
        </p>

        {user && profile ? (
          <div className="welcome">
            <h2>Bienvenue, {profile.full_name || "Utilisateur"} !</h2>
            <p>
              {profile.role === "teacher"
                ? "Espace professeur"
                : "Espace étudiant"}
            </p>
            <button onClick={logout}>Se déconnecter</button>
          </div>
        ) : (
          <form onSubmit={login}>
            <label>Adresse e-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="exemple@email.com"
              required
            />

            <label>Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Votre mot de passe"
              required
            />

            {error && <p className="error">{error}</p>}

            <button type="submit" disabled={loading}>
              {loading ? "Connexion..." : "Se connecter"}
            </button>
          </form>
        )}

        <p className="footer">
          ÉvalClasse Live · Espace sécurisé
        </p>
      </section>
    </main>
  );
}

