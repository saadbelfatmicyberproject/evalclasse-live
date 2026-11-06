import React, { useState, useEffect } from "react";
import { supabase } from "./supabase";
export default function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [students, setStudents] = useState([]);
  const [presentations, setPresentations] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [grades, setGrades] = useState([]);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState("");
  const [studentPresentations, setStudentPresentations] = useState([]);
  const [studentEvaluations, setStudentEvaluations] = useState([]);
  const [selectedPresentation, setSelectedPresentation] = useState("");
  const [studentScore, setStudentScore] = useState("");
  const [studentComment, setStudentComment] = useState("");
  const [studentLoading, setStudentLoading] = useState(false);
  const [studentError, setStudentError] = useState("");
  const [studentSuccess, setStudentSuccess] = useState("");
   async function login(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const { data, error } =
      await supabase.auth.signInWithPassword({
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

  async function loadDashboard() {
    setDataLoading(true);
    setDataError("");

    const results = await Promise.all([
      supabase.from("profiles")
        .select("id, full_name, student_code, role")
        .eq("role", "student"),

      supabase.from("presentations")
        .select("id, title, presenter_id, presentation_date")
        .order("created_at", { ascending: false }),

      supabase.from("evaluations")
        .select("id, presentation_id, evaluator_id, score, comment"),

      supabase.from("final_grades")
        .select("id, presentation_id, student_id, score, teacher_comment")
    ]);

    const failed = results.find(result => result.error);

    if (failed) {
      setDataError(
        "Erreur de chargement : " + failed.error.message
      );
    } else {
      setStudents(results[0].data || []);
      setPresentations(results[1].data || []);
      setEvaluations(results[2].data || []);
      setGrades(results[3].data || []);
    }

    setDataLoading(false);
  }
async function loadStudentData() {
  setStudentLoading(true);
  setStudentError("");

  const { data: presentationData, error: presentationError } =
    await supabase
      .from("presentations")
      .select("id, title, presenter_id, presentation_date")
      .order("created_at", { ascending: false });

  if (presentationError) {
    setStudentError("Erreur de chargement des présentations : " + presentationError.message);
    setStudentLoading(false);
    return;
  }

  const { data: evaluationData, error: evaluationError } =
    await supabase
      .from("evaluations")
      .select("id, presentation_id, evaluator_id, score, comment")
      .eq("evaluator_id", user.id);

  if (evaluationError) {
    setStudentError("Erreur de chargement des évaluations : " + evaluationError.message);
    setStudentLoading(false);
    return;
  }

  setStudentPresentations(presentationData || []);
  setStudentEvaluations(evaluationData || []);
  setStudentLoading(false);
}
 useEffect(() => {
  if (user && profile?.role === "teacher") {
    loadDashboard();
  } 
  if (user && profile?.role === "student") {
    loadStudentData();
  }
}, [user, profile]);
  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setStudents([]);
    setPresentations([]);
    setEvaluations([]);
    setGrades([]);
    setEmail("");
    setPassword("");
  }

  const tabs = [
    ["dashboard", "Tableau de bord"],
    ["students", "Étudiants"],
    ["presentations", "Présentations"],
    ["evaluations", "Évaluations"],
    ["grades", "Notes finales"]
  ];

  const buttonStyle = (active) => ({
    padding: "11px 15px",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    background: active ? "#173b68" : "#edf2f7",
    color: active ? "white" : "#263445",
    fontWeight: "600"
  });

  if (!user || !profile) {
    return (
      <main className="app">
        <section className="login-card">
          <div className="logo">É</div>
          <h1>ÉvalClasse Live</h1>
          <p className="subtitle">
            La plateforme interactive d'évaluation des présentations
          </p>

          <form onSubmit={login}>
            <label>Adresse e-mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="exemple@email.com"
              required
            />

            <label>Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Votre mot de passe"
              required
            />

            {error && <p className="error">{error}</p>}

            <button type="submit" disabled={loading}>
              {loading ? "Connexion..." : "Se connecter"}
            </button>
          </form>

          <p className="footer">
            ÉvalClasse Live · Espace sécurisé
          </p>
        </section>
      </main>
    );
  }
if (profile.role === "student") {
  return (
    <main style={{
      minHeight: "100vh",
      background: "#f3f6fa",
      padding: "25px",
      fontFamily: "Arial, sans-serif",
      color: "#203047"
    }}>
      <header style={{
        background: "#173b68",
        color: "white",
        padding: "25px",
        borderRadius: "14px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap"
      }}>
        <div>
          <h1>ÉvalClasse Live</h1>
          <h2>Espace étudiant</h2>
          <p>Bienvenue, {profile.full_name || "Étudiant"} !</p>
        </div>

        <button onClick={logout}>
          Se déconnecter
        </button>
      </header>

      <section style={{
        background: "white",
        padding: "22px",
        marginTop: "25px",
        borderRadius: "12px"
      }}>
        <h2>Mes présentations</h2>

        {studentLoading && <p>Chargement des présentations...</p>}

        {studentError && (
          <p style={{ color: "red" }}>{studentError}</p>
        )}

        {!studentLoading && studentPresentations.length === 0 && (
          <p>Aucune présentation disponible pour le moment.</p>
        )}

        {studentPresentations.map(item => (
          <div key={item.id} style={{
            border: "1px solid #ddd",
            padding: "15px",
            borderRadius: "8px",
            marginBottom: "12px"
          }}>
            <h3>{item.title}</h3>
            <p>
              Date : {item.presentation_date || "Non définie"}
            </p>
          </div>
        ))}
      </section>

      <section style={{
        background: "white",
        padding: "22px",
        marginTop: "20px",
        borderRadius: "12px"
      }}>
        <h2>Mes évaluations</h2>

        {studentEvaluations.length === 0 ? (
          <p>Vous n'avez pas encore effectué d'évaluation.</p>
        ) : (
          studentEvaluations.map(item => (
            <div key={item.id} style={{
              borderBottom: "1px solid #ddd",
              padding: "12px"
            }}>
              <p>Présentation : {item.presentation_id}</p>
              <p>Note : {item.score}/20</p>
              <p>Commentaire : {item.comment}</p>
            </div>
          ))
        )}
      </section>
    </main>
  );
} 
  return (
    <main style={{
      minHeight: "100vh",
      background: "#f3f6fa",
      padding: "25px",
      fontFamily: "Arial, sans-serif",
      color: "#203047"
    }}>
      <header style={{
        background: "#173b68",
        color: "white",
        padding: "24px",
        borderRadius: "14px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "15px"
      }}>
        <div>
          <h1 style={{ margin: 0 }}>ÉvalClasse Live</h1>
          <p>Tableau de bord professeur</p>
          <strong>
            Bienvenue, {profile.full_name || "Professeur"}
          </strong>
        </div>

        <button
          onClick={logout}
          style={{
            padding: "12px 18px",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer"
          }}
        >
          Se déconnecter
        </button>
      </header>

      <nav style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "9px",
        margin: "22px 0"
      }}>
        {tabs.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={buttonStyle(activeTab === key)}
          >
            {label}
          </button>
        ))}
      </nav>

      <button
        onClick={loadDashboard}
        disabled={dataLoading}
        style={{
          padding: "10px 16px",
          border: "1px solid #ccd5e0",
          borderRadius: "8px",
          cursor: "pointer",
          background: "white",
          marginBottom: "15px"
        }}
      >
        {dataLoading ? "Actualisation..." : "Actualiser les données"}
      </button>

      {dataError && (
        <p style={{ color: "red" }}>{dataError}</p>
      )}

      {activeTab === "dashboard" && (
        <>
          <h2>Vue générale</h2>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "16px"
          }}>
            {[
              ["Étudiants", students.length],
              ["Présentations", presentations.length],
              ["Évaluations", evaluations.length],
              ["Notes finales", grades.length]
            ].map(([label, number]) => (
              <div key={label} style={{
                background: "white",
                padding: "25px",
                borderRadius: "12px",
                boxShadow: "0 2px 8px #00000010"
              }}>
                <p style={{ color: "#66758a" }}>{label}</p>
                <h2 style={{ fontSize: "32px", margin: 0 }}>
                  {number}
                </h2>
              </div>
            ))}
          </div>

          <h2 style={{ marginTop: "30px" }}>
            Bienvenue dans votre espace professeur
          </h2>
          <p>
            Utilisez les onglets pour consulter les étudiants,
            les présentations, les évaluations et les notes finales.
          </p>
        </>
      )}

      {activeTab === "students" && (
        <>
          <h2>Liste des étudiants</h2>
          <p>Total : {students.length} étudiants</p>

          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th>Nom complet</th>
                  <th>Code étudiant</th>
                  <th>Identifiant</th>
                </tr>
              </thead>
              <tbody>
                {students.map(student => (
                  <tr key={student.id}>
                    <td>{student.full_name}</td>
                    <td>{student.student_code}</td>
                    <td>{student.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === "presentations" && (
        <>
          <h2>Liste des présentations</h2>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th>Titre</th>
                <th>Présentateur (ID)</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {presentations.map(item => (
                <tr key={item.id}>
                  <td>{item.title}</td>
                  <td>{item.presenter_id}</td>
                  <td>{item.presentation_date || "Non définie"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {activeTab === "evaluations" && (
        <>
          <h2>Évaluations des étudiants</h2>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th>Présentation</th>
                <th>Évaluateur (ID)</th>
                <th>Note /20</th>
                <th>Commentaire</th>
              </tr>
            </thead>
            <tbody>
              {evaluations.map(item => (
                <tr key={item.id}>
                  <td>{item.presentation_id}</td>
                  <td>{item.evaluator_id}</td>
                  <td>{item.score}</td>
                  <td>{item.comment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {activeTab === "grades" && (
        <>
          <h2>Notes finales</h2>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th>Étudiant (ID)</th>
                <th>Présentation</th>
                <th>Note finale</th>
                <th>Commentaire du professeur</th>
              </tr>
            </thead>
            <tbody>
              {grades.map(item => (
                <tr key={item.id}>
                  <td>{item.student_id}</td>
                  <td>{item.presentation_id}</td>
                  <td>{item.score}</td>
                  <td>{item.teacher_comment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <footer style={{
        marginTop: "35px",
        textAlign: "center",
        color: "#77869a"
      }}>
        ÉvalClasse Live · Espace sécurisé
      </footer>
    </main>
  );
}

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  background: "white",
  borderRadius: "10px",
  overflow: "hidden"
};


