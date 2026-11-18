import React, { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import * as XLSX from "xlsx";

const page = { minHeight: "100vh", background: "#f3f6fa", padding: 24, fontFamily: "Arial, sans-serif", color: "#203047" };
const panel = { background: "white", padding: 24, marginTop: 22, borderRadius: 12, boxShadow: "0 2px 8px #0000000d" };
const button = { padding: "12px 20px", background: "#173b68", color: "white", border: 0, borderRadius: 8, cursor: "pointer", fontWeight: 600 };
const field = { display: "block", width: "100%", boxSizing: "border-box", padding: 12, margin: "9px 0 18px", borderRadius: 8, border: "1px solid #ccd5e0", font: "inherit" };

function timerText(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

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
  const [studentEvaluations, setStudentEvaluations] = useState([]);
  const [grades, setGrades] = useState([]);

  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState("");
  const [actionError, setActionError] = useState("");
  const [drawLoading, setDrawLoading] = useState(false);
  const [finishLoading, setFinishLoading] = useState(false);

  const [teacherScore, setTeacherScore] = useState("");
  const [teacherComment, setTeacherComment] = useState("");
  const [teacherError, setTeacherError] = useState("");

  const [studentScore, setStudentScore] = useState("");
  const [studentComment, setStudentComment] = useState("");
  const [studentLoading, setStudentLoading] = useState(false);
  const [studentError, setStudentError] = useState("");
  const [studentSuccess, setStudentSuccess] = useState("");

  const [clockNow, setClockNow] = useState(Date.now());
  const activationAttempt = useRef(null);
  const profileRequest = useRef(0);

  async function restoreProfile(authUser) {
    const requestId = ++profileRequest.current;
    setUser(authUser);
    setProfile(null);

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", authUser.id)
      .single();

    if (requestId !== profileRequest.current) return;

    if (profileError) {
      setError("Impossible de récupérer votre profil : " + profileError.message);
      setProfile(null);
      return;
    }

    setError("");
    setProfile(profileData);
  }

  // Restaurer automatiquement la session Supabase après un rechargement.
  useEffect(() => {
    let mounted = true;

    const applySession = (session) => {
      if (!mounted) return;

      if (session?.user) {
        // Différer la lecture du profil hors du callback d'authentification.
        Promise.resolve().then(() => {
          if (mounted) restoreProfile(session.user);
        });
      } else {
        profileRequest.current += 1;
        setUser(null);
        setProfile(null);
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return;
      if (sessionError) {
        setError("Impossible de restaurer la session : " + sessionError.message);
        return;
      }
      applySession(data.session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      profileRequest.current += 1;
    };
  }, []);

  async function login(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const { data, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (loginError) {
      setError("Adresse e-mail ou mot de passe incorrect.");
      setLoading(false);
      return;
    }
    await restoreProfile(data.user);
    setLoading(false);
  }

  async function loadDashboard() {
    setDataLoading(true);
    setDataError("");
    const results = await Promise.all([
      supabase.from("profiles").select("id, full_name, student_code, role").eq("role", "student"),
      supabase.from("presentations")
        .select("id, title, presenter_id, presentation_date, is_completed, status, selected_at, evaluations_starts_at")
        .order("created_at", { ascending: false }),
      supabase.from("evaluations").select("id, presentation_id, evaluator_id, score, comment, created_at"),
      supabase.from("final_grades").select("id, presentation_id, student_id, score, teacher_comment, created_at")
    ]);
    const failed = results.find((r) => r.error);
    if (failed) {
      setDataError("Erreur de chargement : " + failed.error.message);
    } else {
      setStudents(results[0].data || []);
      setPresentations(results[1].data || []);
      setEvaluations(results[2].data || []);
      setGrades(results[3].data || []);
    }
    setDataLoading(false);
  }

  async function loadStudentData() {
    setDataLoading(true);
    setDataError("");
    const [p, e] = await Promise.all([
      supabase.from("presentations")
        .select("id, title, presenter_id, presentation_date, is_completed, status, selected_at, evaluations_starts_at")
        .order("created_at", { ascending: false }),
      supabase.from("evaluations")
        .select("id, presentation_id, evaluator_id, score, comment, created_at")
        .eq("evaluator_id", user.id)
    ]);
    if (p.error || e.error) {
      setDataError("Erreur de chargement : " + (p.error || e.error).message);
    } else {
      setPresentations(p.data || []);
      setStudentEvaluations(e.data || []);
    }
    setDataLoading(false);
  }

  async function refreshData() {
    if (!user || !profile) return;
    if (profile.role === "teacher") await loadDashboard();
    if (profile.role === "student") await loadStudentData();
  }

  async function drawRandomPresentation() {
    setDrawLoading(true);
    setActionError("");
    const { error: rpcError } = await supabase.rpc("draw_random_presentation");
    if (rpcError) setActionError(rpcError.message);
    else await loadDashboard();
    setDrawLoading(false);
  }

  async function finishPresentation(event) {
    event.preventDefault();
    setTeacherError("");
    setActionError("");
    const score = Number(teacherScore);
    if (teacherScore === "" || !Number.isFinite(score) || score < 0 || score > 20) {
      setTeacherError("La note doit être comprise entre 0 et 20.");
      return;
    }
    if (!currentPresentation || currentPresentation.status !== "active") {
      setTeacherError("Les évaluations ne sont pas encore ouvertes.");
      return;
    }

    setFinishLoading(true);
    const { error: gradeError } = await supabase.from("final_grades").upsert({
      presentation_id: currentPresentation.id,
      student_id: currentPresentation.presenter_id,
      score,
      teacher_comment: teacherComment.trim()
    }, { onConflict: "student_id,presentation_id" });

    if (gradeError) {
      setTeacherError("Erreur d'enregistrement de la note : " + gradeError.message);
      setFinishLoading(false);
      return;
    }

    const { error: completeError } = await supabase.rpc("complete_presentation", {
      p_presentation_id: currentPresentation.id
    });
    if (completeError) {
      setTeacherError("La note est enregistrée, mais la clôture a échoué : " + completeError.message);
      await loadDashboard();
      setFinishLoading(false);
      return;
    }

    setTeacherScore("");
    setTeacherComment("");
    await loadDashboard();
    setFinishLoading(false);
  }

  async function submitEvaluation(event) {
    event.preventDefault();
    setStudentError("");
    setStudentSuccess("");
    if (!currentPresentation || currentPresentation.status !== "active") {
      setStudentError("Les évaluations ne sont pas ouvertes.");
      return;
    }
    if (currentPresentation.presenter_id === user.id) {
      setStudentError("Vous ne pouvez pas évaluer votre propre présentation.");
      return;
    }
    const score = Number(studentScore);
    if (studentScore === "" || !Number.isFinite(score) || score < 0 || score > 20) {
      setStudentError("La note doit être comprise entre 0 et 20.");
      return;
    }
    setStudentLoading(true);
    const { error: insertError } = await supabase.from("evaluations").insert({
      presentation_id: currentPresentation.id,
      evaluator_id: user.id,
      score,
      comment: studentComment.trim()
    });
    if (insertError) {
      setStudentError("Erreur d'enregistrement : " + insertError.message);
    } else {
      setStudentSuccess("Votre évaluation a été enregistrée. Merci !");
      setStudentScore("");
      setStudentComment("");
      await loadStudentData();
    }
    setStudentLoading(false);
  }

  function exportGradesToExcel() {
    const rows = presentations
      .filter((p) => p.status === "completed" || p.is_completed === true)
      .map((p) => {
        const grade = grades.find((g) => g.presentation_id === p.id);
        const submitted = evaluations.filter((e) => e.presentation_id === p.id);
        const average = submitted.length
          ? submitted.reduce((sum, e) => sum + Number(e.score || 0), 0) / submitted.length
          : null;
        const finalGrade = average !== null && grade
          ? (average * 0.5) + (Number(grade.score) * 0.5)
          : null;
        const student = students.find((s) => s.id === p.presenter_id);
        return {
          "Full names": student?.full_name || "Nom inconnu",
          "Moyenne des étudiants": average === null ? "" : Number(average.toFixed(2)),
          "Note du professeur": grade ? Number(grade.score) : "",
          "Commentaire du professeur": grade?.teacher_comment || "",
          "Final grades": finalGrade === null ? "" : Number(finalGrade.toFixed(2))
        };
      });
    const sheet = XLSX.utils.json_to_sheet(rows, {
      header: ["Full names", "Moyenne des étudiants", "Note du professeur", "Commentaire du professeur", "Final grades"]
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Résultats");
    XLSX.writeFile(workbook, "EvalClasse_Live_Resultats.xlsx");
  }

  async function logout() {
    profileRequest.current += 1;
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setStudents([]);
    setPresentations([]);
    setEvaluations([]);
    setStudentEvaluations([]);
    setGrades([]);
    setEmail("");
    setPassword("");
    setTeacherScore("");
    setTeacherComment("");
    setStudentScore("");
    setStudentComment("");
  }

  useEffect(() => {
    if (!user || !profile) return;
    refreshData();

    const channel = supabase.channel("evalclasse-live-room")
      .on("postgres_changes", { event: "*", schema: "public", table: "presentations" }, refreshData)
      .on("postgres_changes", { event: "*", schema: "public", table: "evaluations" }, refreshData)
      .on("postgres_changes", { event: "*", schema: "public", table: "final_grades" }, refreshData)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile]);

  useEffect(() => {
    const id = setInterval(() => setClockNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const currentPresentation = presentations.find(
    (p) => p.status === "observing" || p.status === "active"
  );
  const startAt = currentPresentation?.evaluations_starts_at
    ? new Date(currentPresentation.evaluations_starts_at).getTime()
    : null;
  const secondsRemaining = startAt === null ? 0 : Math.max(0, Math.ceil((startAt - clockNow) / 1000));
  const countdown = timerText(secondsRemaining);
  const currentEvaluations = currentPresentation
    ? evaluations.filter((e) => e.presentation_id === currentPresentation.id)
    : [];
  const average = currentEvaluations.length
    ? currentEvaluations.reduce((sum, e) => sum + Number(e.score || 0), 0) / currentEvaluations.length
    : null;
  const alreadyEvaluated = currentPresentation
    ? studentEvaluations.some((e) => e.presentation_id === currentPresentation.id)
    : false;

  useEffect(() => {
    if (!user || !currentPresentation || currentPresentation.status !== "observing" ||
        secondsRemaining > 0 || activationAttempt.current === currentPresentation.id) return;

    activationAttempt.current = currentPresentation.id;
    supabase.rpc("activate_ready_presentations").then(({ error: activationError }) => {
      if (activationError) {
        setActionError("Le compte à rebours est terminé, mais l'ouverture a échoué : " + activationError.message);
        activationAttempt.current = null;
      } else {
        refreshData();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, currentPresentation?.id, currentPresentation?.status, secondsRemaining]);

  if (!user || !profile) {
    return (
      <main className="app">
        <section className="login-card">
          <div className="logo">É</div>
          <h1>ÉvalClasse Live</h1>
          <p className="subtitle">La plateforme interactive d'évaluation des présentations</p>
          <form onSubmit={login}>
            <label>Adresse e-mail</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="exemple@email.com" required />
            <label>Mot de passe</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Votre mot de passe" required />
            {error && <p style={{ color: "red" }}>{error}</p>}
            <button type="submit" disabled={loading}>{loading ? "Connexion..." : "Se connecter"}</button>
          </form>
          <p className="footer">ÉvalClasse Live · Espace sécurisé</p>
        </section>
      </main>
    );
  }

  if (profile.role === "student") {
    const isPresenter = currentPresentation?.presenter_id === user.id;
    return (
      <main style={page}>
        <header style={{ background: "#173b68", color: "white", padding: 24, borderRadius: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ margin: 0 }}>ÉvalClasse Live</h1>
            <h2>Espace étudiant</h2>
            <p>Bienvenue, {profile.full_name || "Étudiant"} !</p>
          </div>
          <button onClick={logout} style={button}>Se déconnecter</button>
        </header>

        {dataLoading && <p>Synchronisation...</p>}
        {dataError && <p style={{ color: "red" }}>{dataError}</p>}

        {!currentPresentation && (
          <section style={panel}>
            <h2>Aucune présentation n'est actuellement en évaluation</h2>
            <p>Attendez le tirage au sort du professeur. La présentation apparaîtra automatiquement ici.</p>
          </section>
        )}

        {currentPresentation && (
          <section style={panel}>
            <h2>Présentation sélectionnée</h2>
            <h3>{currentPresentation.title}</h3>

            {isPresenter ? (
              <div style={{ padding: 22, background: "#e8f5ee", borderRadius: 10, textAlign: "center", color: "#17643b" }}>
                <h1>C'est votre tour !</h1>
                <p>Vous êtes le présentateur de cette session.</p>
                {currentPresentation.status === "observing" && <h2>Temps d'observation : {countdown}</h2>}
                {currentPresentation.status === "active" && <p>Les étudiants peuvent maintenant évaluer votre présentation.</p>}
              </div>
            ) : currentPresentation.status === "observing" ? (
              <div style={{ padding: 22, background: "#edf4ff", borderRadius: 10, textAlign: "center" }}>
                <h2>Temps d'observation</h2>
                <div style={{ fontSize: 48, fontWeight: 700, color: "#173b68", margin: "15px 0" }}>{countdown}</div>
                <p>Observez la présentation. Les évaluations seront ouvertes à la fin du compte à rebours.</p>
              </div>
            ) : alreadyEvaluated ? (
              <div style={{ padding: 20, background: "#e8f5ee", borderRadius: 10 }}>
                <h3>Votre évaluation a été enregistrée</h3>
                <p>Merci pour votre participation.</p>
              </div>
            ) : (
              <form onSubmit={submitEvaluation}>
                <h2>Évaluer cette présentation</h2>
                <label>Votre note sur 20</label>
                <input style={field} type="number" min="0" max="20" step="0.5" value={studentScore} onChange={(e) => setStudentScore(e.target.value)} required />
                <label>Votre commentaire</label>
                <textarea style={field} rows="4" value={studentComment} onChange={(e) => setStudentComment(e.target.value)} placeholder="Écrivez votre commentaire..." />
                {studentError && <p style={{ color: "red" }}>{studentError}</p>}
                {studentSuccess && <p style={{ color: "green" }}>{studentSuccess}</p>}
                <button type="submit" disabled={studentLoading} style={button}>{studentLoading ? "Enregistrement..." : "Envoyer mon évaluation"}</button>
              </form>
            )}
            {actionError && <p style={{ color: "red" }}>{actionError}</p>}
          </section>
        )}
        <footer style={{ marginTop: 30, textAlign: "center", color: "#77869a" }}>ÉvalClasse Live · Espace sécurisé</footer>
      </main>
    );
  }

  if (profile.role !== "teacher") {
    return <main style={page}><section style={panel}><h2>Rôle non reconnu</h2><button onClick={logout} style={button}>Se déconnecter</button></section></main>;
  }

  return (
    <main style={page}>
      <header style={{ background: "#173b68", color: "white", padding: 24, borderRadius: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>ÉvalClasse Live</h1>
          <h2>Espace professeur</h2>
          <p>Bienvenue, {profile.full_name || "Professeur"}</p>
        </div>
        <button onClick={logout} style={button}>Se déconnecter</button>
      </header>

      {dataError && <p style={{ color: "red" }}>{dataError}</p>}
      {actionError && <p style={{ color: "red" }}>{actionError}</p>}

      {!currentPresentation && (
        <section style={panel}>
          <h2>Gestion des présentations</h2>
          <p>Aucune présentation n'est actuellement en cours. Vous pouvez lancer le prochain tirage.</p>
          <button onClick={drawRandomPresentation} disabled={drawLoading || dataLoading} style={button}>
            {drawLoading ? "Tirage en cours..." : "Lancer le tirage au sort"}
          </button>
          <div style={{ marginTop: 22 }}>
            <button onClick={exportGradesToExcel} style={{ ...button, background: "#16804a" }}>
              Télécharger le fichier Excel des résultats
            </button>
          </div>
        </section>
      )}

      {currentPresentation && (
        <section style={panel}>
          <h2>Présentation tirée au sort</h2>
          <h3>{currentPresentation.title}</h3>

          {currentPresentation.status === "observing" && (
            <div style={{ padding: 22, background: "#edf4ff", borderRadius: 10, textAlign: "center" }}>
              <h2>Temps d'observation</h2>
              <div style={{ fontSize: 48, fontWeight: 700, color: "#173b68", margin: "15px 0" }}>{countdown}</div>
              <p>À la fin des cinq minutes, les évaluations seront ouvertes.</p>
            </div>
          )}

          {currentPresentation.status === "active" && (
            <>
              <div style={{ padding: 18, background: "#e8f5ee", borderRadius: 10, marginBottom: 20 }}>
                <h2 style={{ color: "#17643b", marginTop: 0 }}>Évaluations ouvertes</h2>
                <p>Nombre d'étudiants ayant évalué : <strong>{currentEvaluations.length}</strong></p>
                <p>Moyenne des étudiants : <strong>{average === null ? "Aucune évaluation reçue" : `${average.toFixed(2)}/20`}</strong></p>
                <p style={{ fontSize: 13, color: "#536273" }}>La moyenne utilise uniquement les évaluations réellement enregistrées, pas le nombre d'étudiants connectés.</p>
              </div>

              <form onSubmit={finishPresentation}>
                <h2>Votre évaluation officielle</h2>
                <label>Note du professeur sur 20</label>
                <input style={field} type="number" min="0" max="20" step="0.5" value={teacherScore} onChange={(e) => setTeacherScore(e.target.value)} required />
                <label>Commentaire du professeur</label>
                <textarea style={field} rows="4" value={teacherComment} onChange={(e) => setTeacherComment(e.target.value)} placeholder="Commentaire sur la présentation..." />
                {teacherError && <p style={{ color: "red" }}>{teacherError}</p>}
                <button type="submit" disabled={finishLoading} style={{ ...button, background: "#16804a" }}>
                  {finishLoading ? "Enregistrement et clôture..." : "Enregistrer la note et terminer la présentation"}
                </button>
              </form>
            </>
          )}
        </section>
      )}
      <footer style={{ marginTop: 30, textAlign: "center", color: "#77869a" }}>ÉvalClasse Live · Espace sécurisé</footer>
    </main>
  );
}
