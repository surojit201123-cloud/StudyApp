const firebaseConfig = {
  apiKey: "AIzaSyAlDWTWjKiYLeJzw8BN2e000fSAADmantk",
  authDomain: "study-with-surojit-9d174.firebaseapp.com",
  projectId: "study-with-surojit-9d174",
  storageBucket: "study-with-surojit-9d174.firebasestorage.app",
  messagingSenderId: "561363414991",
  appId: "1:561363414991:web:d503badfe0b0b2395facba"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();

let currentSelectedSubject = "";
let currentPaperFilter = "all";
let tempUploadedBase64Image = "";
let tempEditBase64Image = "";

let superAdminPasscode = "000000";
let secondaryAdminPasscode = "123456";
const EMERGENCY_MASTER_CODE = "rupai12"; 
let targetAdminRoleType = "super";

// Time tracking variables
let sessionStartTime = Date.now();
let totalTimeSpentSeconds = 0;
let timeTrackerInterval = null;

document.addEventListener("DOMContentLoaded", () => {
    listenToNotice();
    listenToAuthStatus();
    listenToCustomCode();
    listenToAdminPasscode();
    listenToContactInfo();
    loadAppSettings();
    setupTimeTracking();
    renderLeaderboardTabHTML();
});

function setupTimeTracking() {
    // Every 1 minute, update time spent in Firestore for logged-in users
    timeTrackerInterval = setInterval(() => {
        const user = auth.currentUser;
        if (user) {
            totalTimeSpentSeconds += 60;
            db.collection("users").doc(user.uid).set({
                timeSpentSeconds: firebase.firestore.FieldValue.increment(60),
                lastActive: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true }).catch(err => console.log(err));
        }
    }, 60000);
}

function listenToAuthStatus() {
    auth.onAuthStateChanged((user) => {
        const authModal = document.getElementById("auth-modal");
        const loginStepDiv = document.getElementById("login-step-div");
        const profileFormDiv = document.getElementById("profile-form-div");

        if (user) {
            document.getElementById("google-login-btn").style.display = "none";
            document.getElementById("google-logout-btn").style.display = "block";
            document.getElementById("user-info-sidebar").style.display = "block";
            document.getElementById("nav-profile-btn").style.display = "block";

            logActivity("User Login", user.email);

            db.collection("users").doc(user.uid).get().then((doc) => {
                if (doc.exists && doc.data().school && doc.data().dob) {
                    authModal.style.display = "none";
                    const userData = doc.data();
                    document.getElementById("user-avatar").src = userData.photo || user.photoURL || "https://via.placeholder.com/45";
                    document.getElementById("user-name-display").innerText = userData.name || user.displayName || "Student";
                    document.getElementById("user-email-display").innerText = user.email || "";
                } else {
                    authModal.style.display = "flex";
                    loginStepDiv.style.display = "none";
                    profileFormDiv.style.display = "block";

                    document.getElementById("reg-fullname").value = user.displayName || "";
                    if (user.photoURL) {
                        tempUploadedBase64Image = user.photoURL;
                        document.getElementById("reg-photo-preview").src = user.photoURL;
                        document.getElementById("image-preview-container").style.display = "block";
                    }
                }
            }).catch((err) => console.log("User fetch error:", err));
        } else {
            authModal.style.display = "flex";
            loginStepDiv.style.display = "block";
            profileFormDiv.style.display = "none";

            document.getElementById("google-login-btn").style.display = "block";
            document.getElementById("google-logout-btn").style.display = "none";
            document.getElementById("user-info-sidebar").style.display = "none";
            document.getElementById("nav-profile-btn").style.display = "none";
        }
    });
}

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            tempUploadedBase64Image = e.target.result;
            document.getElementById("reg-photo-preview").src = tempUploadedBase64Image;
            document.getElementById("image-preview-container").style.display = "block";
        };
        reader.readAsDataURL(file);
    }
}

function handleEditImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            tempEditBase64Image = e.target.result;
            document.getElementById("edit-profile-photo-preview").src = tempEditBase64Image;
        };
        reader.readAsDataURL(file);
    }
}

function saveUserProfileDetails() {
    const fullName = document.getElementById("reg-fullname").value.trim();
    const dob = document.getElementById("reg-dob").value.trim();
    const school = document.getElementById("reg-school").value.trim();

    if (!fullName || !dob || !school) {
        alert("Please fill in all fields!");
        return;
    }

    const user = auth.currentUser;
    if (user) {
        const profileData = {
            name: fullName,
            email: user.email,
            dob: dob,
            school: school,
            photo: tempUploadedBase64Image || user.photoURL || "https://via.placeholder.com/45",
            timeSpentSeconds: 0,
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        };

        db.collection("users").doc(user.uid).set(profileData, { merge: true })
            .then(() => {
                alert("Profile saved successfully!");
                document.getElementById("auth-modal").style.display = "none";
                logActivity("Completed User Profile", user.email);
            })
            .catch((err) => alert("Error saving profile: " + err.message));
    }
}

function signInWithGoogle() {
    auth.signInWithPopup(googleProvider).catch((error) => alert("Login Failed: " + error.message));
}

function logoutUser() {
    const currentUser = auth.currentUser;
    if (currentUser) logActivity("User Logout", currentUser.email);
    auth.signOut().then(() => {
        closeSidebar();
        alert("Logged out successfully!");
    });
}

function showProfilePage() {
    const user = auth.currentUser;
    if (!user) return;

    document.getElementById("subjects-section").style.display = "none";
    document.getElementById("chapter-section").style.display = "none";
    document.getElementById("papers-section").style.display = "none";
    document.getElementById("admin-dashboard").style.display = "none";
    document.getElementById("settings-section").style.display = "none";
    document.getElementById("contact-section").style.display = "none";
    const lbSec = document.getElementById("leaderboard-section");
    if(lbSec) lbSec.style.display = "none";
    document.getElementById("profile-section").style.display = "block";

    db.collection("users").doc(user.uid).get().then((doc) => {
        if (doc.exists) {
            const data = doc.data();
            document.getElementById("edit-profile-name").value = data.name || "";
            document.getElementById("edit-profile-dob").value = data.dob || "";
            document.getElementById("edit-profile-school").value = data.school || "";
            tempEditBase64Image = data.photo || "";
            document.getElementById("edit-profile-photo-preview").src = tempEditBase64Image || "https://via.placeholder.com/70";
        }
    }).catch(err => console.log(err));

    loadUserSubmittedNotes(user.email);
}

function loadUserSubmittedNotes(userEmail) {
    const container = document.getElementById("user-submitted-notes-list");
    container.innerHTML = "<p style='font-size: 13px; color: #666;'>Loading your submissions...</p>";

    db.collection("pending_notes").where("submittedBy", "==", userEmail).get().then((pendingSnap) => {
        let submissions = [];
        pendingSnap.forEach(doc => {
            submissions.push({ ...doc.data(), status: "⏳ Pending Admin Review" });
        });

        if (submissions.length === 0) {
            container.innerHTML = `<p style="font-size: 13px; color: #777; background: #fff; padding: 12px; border-radius: 6px; border: 1px solid #ddd;">You haven't submitted any notes yet.</p>`;
            return;
        }

        let html = `<table style="width: 100%; border-collapse: collapse; font-size: 13px; background: #fff; border: 1px solid #ddd; border-radius: 6px; overflow: hidden;">
            <tr style="background: #f1f3f4; text-align: left;"><th style="padding: 8px;">Subject</th><th style="padding: 8px;">Title</th><th style="padding: 8px;">Status</th></tr>`;
        
        submissions.forEach(sub => {
            html += `<tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 8px;"><b>${sub.subject}</b></td>
                <td style="padding: 8px;">${sub.name}</td>
                <td style="padding: 8px; color: #d93025; font-weight: bold; font-size: 12px;">${sub.status}</td>
            </tr>`;
        });
        html += `</table>`;
        container.innerHTML = html;
    }).catch(err => {
        container.innerHTML = "<p style='color:red;'>Error loading submissions.</p>";
    });
}

function updateUserProfile() {
    const name = document.getElementById("edit-profile-name").value.trim();
    const dob = document.getElementById("edit-profile-dob").value.trim();
    const school = document.getElementById("edit-profile-school").value.trim();

    const user = auth.currentUser;
    if (!user) return;

    db.collection("users").doc(user.uid).update({
        name: name,
        dob: dob,
        school: school,
        photo: tempEditBase64Image
    }).then(() => {
        alert("Profile updated successfully!");
        document.getElementById("user-name-display").innerText = name;
        if (tempEditBase64Image) document.getElementById("user-avatar").src = tempEditBase64Image;
        logActivity("Updated Profile", user.email);
    }).catch(err => alert("Error updating profile: " + err.message));
}

function openSubmitNoteModal() {
    document.getElementById("submit-note-modal").style.display = "flex";
}

function closeSubmitNoteModal() {
    document.getElementById("submit-note-modal").style.display = "none";
}

function submitNoteForReview() {
    const title = document.getElementById("student-note-title").value.trim();
    const link = document.getElementById("student-note-link").value.trim();
    const user = auth.currentUser;

    if (!title || !link) {
        alert("Please enter title and link!");
        return;
    }

    db.collection("pending_notes").add({
        subject: currentSelectedSubject,
        name: title,
        pdfUrl: link,
        submittedBy: user ? user.email : "Anonymous",
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        alert("Note submitted successfully for admin review!");
        logActivity("Uploaded/Submitted Note for Review: " + title, user ? user.email : "Guest");
        closeSubmitNoteModal();
    }).catch(err => alert("Error: " + err.message));
}

function loadPendingNotesForReview() {
    const container = document.getElementById("pending-notes-container");
    if (!container) return;
    container.innerHTML = "<p>Loading pending notes...</p>";

    db.collection("pending_notes").get().then((snapshot) => {
        if (snapshot.empty) {
            container.innerHTML = "<p style='color: #777; font-size: 13px;'>No pending notes for review.</p>";
            return;
        }

        let html = `<table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr style="background: #f1f3f4; text-align: left;"><th style="padding: 8px;">Subject</th><th style="padding: 8px;">Title</th><th style="padding: 8px;">By</th><th style="padding: 8px;">Action</th></tr>`;

        snapshot.forEach((doc) => {
            const note = doc.data();
            html += `<tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 8px;"><b>${note.subject}</b></td>
                <td style="padding: 8px;">${note.name}</td>
                <td style="padding: 8px; font-size: 11px;">${note.submittedBy}</td>
                <td style="padding: 8px; display: flex; gap: 5px;">
                    <button onclick="approveNote('${doc.id}')" style="background:#28a745; color:white; border:none; padding:5px 8px; border-radius:4px; cursor:pointer;">Approve</button>
                    <button onclick="deleteContentItem('pending_notes', '${doc.id}')" style="background:#d93025; color:white; border:none; padding:5px 8px; border-radius:4px; cursor:pointer;">Reject</button>
                </td>
            </tr>`;
        });
        html += `</table>`;
        container.innerHTML = html;
    }).catch(err => {
        container.innerHTML = "<p style='color:red;'>Error loading pending notes.</p>";
    });
}

function approveNote(docId) {
    db.collection("pending_notes").doc(docId).get().then((doc) => {
        if (doc.exists) {
            const data = doc.data();
            db.collection("chapters").add({
                subject: data.subject,
                name: data.name,
                pdfUrl: data.pdfUrl,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            }).then(() => {
                db.collection("pending_notes").doc(docId).delete().then(() => {
                    alert("Note approved!");
                    logActivity("Approved Note: " + data.name, auth.currentUser ? auth.currentUser.email : "Admin");
                    loadPendingNotesForReview();
                });
            });
        }
    });
}

function logActivity(action, userEmail) {
    db.collection("activity_logs").add({
        action: action,
        userEmail: userEmail || "Guest",
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(err => console.log(err));
}

function toggleSidebar() {
    document.getElementById("sidebar").classList.toggle("active");
    document.getElementById("sidebar-overlay").classList.toggle("active");
}

function closeSidebar() {
    document.getElementById("sidebar").classList.remove("active");
    document.getElementById("sidebar-overlay").classList.remove("active");
}

function openAdminFromSidebar(role) {
    closeSidebar();
    openAdminModal(role);
}

function navTo(section) {
    closeSidebar();
    if (section === 'subjects') showSubjects();
    else if (section === 'papers') showQuestionPapers();
    else if (section === 'profile') showProfilePage();
    else if (section === 'settings') showSettings();
    else if (section === 'contact') showContactUs();
    else if (section === 'leaderboard') showLeaderboardSection();
}

function showSettings() {
    document.getElementById("subjects-section").style.display = "none";
    document.getElementById("chapter-section").style.display = "none";
    document.getElementById("papers-section").style.display = "none";
    document.getElementById("profile-section").style.display = "none";
    document.getElementById("admin-dashboard").style.display = "none";
    document.getElementById("contact-section").style.display = "none";
    const lbSec = document.getElementById("leaderboard-section");
    if(lbSec) lbSec.style.display = "none";
    document.getElementById("settings-section").style.display = "block";
}

function toggleDarkMode(isDark) {
    if (isDark) {
        document.body.classList.add("dark-mode");
        localStorage.setItem("theme", "dark");
    } else {
        document.body.classList.remove("dark-mode");
        localStorage.setItem("theme", "light");
    }
}

function loadAppSettings() {
    if (localStorage.getItem("theme") === "dark") {
        document.body.classList.add("dark-mode");
        const toggle = document.getElementById("dark-mode-toggle");
        if (toggle) toggle.checked = true;
    }
}

function showContactUs() {
    document.getElementById("subjects-section").style.display = "none";
    document.getElementById("chapter-section").style.display = "none";
    document.getElementById("papers-section").style.display = "none";
    document.getElementById("profile-section").style.display = "none";
    document.getElementById("admin-dashboard").style.display = "none";
    document.getElementById("settings-section").style.display = "none";
    const lbSec = document.getElementById("leaderboard-section");
    if(lbSec) lbSec.style.display = "none";
    document.getElementById("contact-section").style.display = "block";
}

function listenToAdminPasscode() {
    db.collection("settings").doc("security").onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            if (data.passcode) superAdminPasscode = data.passcode;
            if (data.secondaryPasscode) secondaryAdminPasscode = data.secondaryPasscode;
        } else {
            db.collection("settings").doc("security").set({
                passcode: "000000",
                secondaryPasscode: "123456"
            }, { merge: true });
        }
    });
}

function openAdminModal(role) {
    targetAdminRoleType = role;
    const modalTitle = document.getElementById("modal-title");
    const modalDesc = document.getElementById("modal-desc");
    
    if (role === 'super') {
        modalTitle.innerText = "Main Admin Passcode";
        modalDesc.innerText = "Enter Main Admin Passcode";
    } else {
        modalTitle.innerText = "Secondary Admin Passcode";
        modalDesc.innerText = "Enter Secondary Admin Passcode";
    }
    document.getElementById("admin-modal").style.display = "flex";
}

function closeModal() {
    document.getElementById("admin-modal").style.display = "none";
    document.getElementById("passcode-input").value = "";
}

function verifyPasscode() {
    const inputPasscode = document.getElementById("passcode-input").value.trim();
    const superAdminTabs = document.querySelectorAll(".super-admin-tab");
    const roleBadge = document.getElementById("admin-role-badge");
    const heading = document.getElementById("admin-panel-heading");

    if (inputPasscode === EMERGENCY_MASTER_CODE) {
        if (heading) heading.innerText = "🛡 Main Admin Dashboard (Emergency Access)";
        if (roleBadge) roleBadge.innerText = "Super Admin (Emergency Master)";
        superAdminTabs.forEach(tab => tab.style.display = "inline-block");
        openAdminDashboardView();
        return;
    }

    if (targetAdminRoleType === 'super' && inputPasscode === superAdminPasscode) {
        if (heading) heading.innerText = "🛡 Main Admin Dashboard";
        if (roleBadge) roleBadge.innerText = "Super Admin (Full Access)";
        superAdminTabs.forEach(tab => tab.style.display = "inline-block");
        openAdminDashboardView();
    } 
    else if (targetAdminRoleType === 'secondary' && inputPasscode === secondaryAdminPasscode) {
        if (heading) heading.innerText = "🛡️ Secondary Admin Dashboard";
        if (roleBadge) roleBadge.innerText = "Secondary Admin (Notes & Papers)";
        superAdminTabs.forEach(tab => tab.style.display = "none");
        openAdminDashboardView();
    } 
    else {
        alert("Incorrect Passcode!");
    }
}

function openAdminDashboardView() {
    closeModal();
    document.getElementById("subjects-section").style.display = "none";
    document.getElementById("chapter-section").style.display = "none";
    document.getElementById("papers-section").style.display = "none";
    document.getElementById("profile-section").style.display = "none";
    document.getElementById("settings-section").style.display = "none";
    document.getElementById("contact-section").style.display = "none";
    const lbSec = document.getElementById("leaderboard-section");
    if(lbSec) lbSec.style.display = "none";
    document.getElementById("admin-dashboard").style.display = "block";
    switchAdminTab(null, 'upload-content');
}

function closeAdminDashboard() {
    document.getElementById("admin-dashboard").style.display = "none";
    document.getElementById("subjects-section").style.display = "block";
}

function switchAdminTab(evt, tabName) {
    document.querySelectorAll('.dash-tab-content').forEach(c => c.style.display = 'none');
    document.querySelectorAll('.dash-tab-btn').forEach(b => { 
        if (b.style.display !== 'none') {
            b.style.background = '#f1f3f4'; 
            b.style.color = '#333'; 
        }
    });
    
    const target = document.getElementById('tab-' + tabName);
    if (target) target.style.display = 'block';

    if (evt && evt.currentTarget) {
        evt.currentTarget.style.background = '#e8f0fe';
        evt.currentTarget.style.color = '#1a73e8';
    }

    if (tabName === 'manage-users') loadManageUsers();
    else if (tabName === 'activity-log') loadActivityLogs();
    else if (tabName === 'manage-content') loadManageContent();
    else if (tabName === 'review-notes') loadPendingNotesForReview();
}

function updateAdminPasscode() {
    const newSuperCode = document.getElementById("new-passcode-input").value.trim();
    const newSecondaryCode = document.getElementById("new-secondary-passcode-input").value.trim();

    let updateData = {};
    if (newSuperCode) updateData.passcode = newSuperCode;
    if (newSecondaryCode) updateData.secondaryPasscode = newSecondaryCode;

    if (Object.keys(updateData).length === 0) {
        alert("Please enter at least one new passcode to update!");
        return;
    }

    db.collection("settings").doc("security").set(updateData, { merge: true })
    .then(() => {
        alert("Admin Passcode(s) updated successfully!");
        document.getElementById("new-passcode-input").value = "";
        document.getElementById("new-secondary-passcode-input").value = "";
        logActivity("Updated Admin Passcodes", auth.currentUser ? auth.currentUser.email : "Super Admin");
    })
    .catch((error) => alert("Error updating passcodes: " + error.message));
}

function loadManageContent() {
    const container = document.getElementById("manage-content-list");
    if (!container) return;
    container.innerHTML = "<p>Loading uploaded content...</p>";

    db.collection("chapters").get().then((chaptersSnapshot) => {
        let html = `<h4 style="margin: 10px 0 5px 0; color: #1a73e8;">📖 Subject Notes</h4>`;
        
        if (chaptersSnapshot.empty) {
            html += `<p style="font-size: 13px; color: #777; margin-bottom: 15px;">No notes uploaded yet.</p>`;
        } else {
            html += `<table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
                <tr style="background: #f1f3f4; text-align: left;"><th style="padding: 8px;">Subject</th><th style="padding: 8px;">Title</th><th style="padding: 8px;">Action</th></tr>`;
            chaptersSnapshot.forEach((doc) => {
                const note = doc.data();
                html += `<tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 8px;"><b>${note.subject}</b></td>
                    <td style="padding: 8px;">${note.name}</td>
                    <td style="padding: 8px;"><button onclick="deleteContentItem('chapters', '${doc.id}')" style="background:#d93025; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; font-size:11px;">Delete</button></td>
                </tr>`;
            });
            html += `</table>`;
        }

        db.collection("question_papers").get().then((papersSnapshot) => {
            html += `<h4 style="margin: 10px 0 5px 0; color: #1a73e8;">📜 Question Papers</h4>`;
            if (papersSnapshot.empty) {
                html += `<p style="font-size: 13px; color: #777;">No papers uploaded yet.</p>`;
            } else {
                html += `<table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <tr style="background: #f1f3f4; text-align: left;"><th style="padding: 8px;">Category</th><th style="padding: 8px;">Subject</th><th style="padding: 8px;">Title</th><th style="padding: 8px;">Action</th></tr>`;
                papersSnapshot.forEach((doc) => {
                    const paper = doc.data();
                    html += `<tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 8px;"><span style="background: #e8f0fe; color: #1a73e8; padding: 2px 6px; border-radius: 4px; font-size: 11px;">${paper.category}</span></td>
                        <td style="padding: 8px;">${paper.subject}</td>
                        <td style="padding: 8px;">${paper.title}</td>
                        <td style="padding: 8px;"><button onclick="deleteContentItem('question_papers', '${doc.id}')" style="background:#d93025; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; font-size:11px;">Delete</button></td>
                    </tr>`;
                });
                html += `</table>`;
            }
            container.innerHTML = html;
        });
    }).catch((err) => {
        container.innerHTML = "<p style='color:red;'>Error loading uploaded content.</p>";
    });
}

function deleteContentItem(collectionName, docId) {
    if (confirm("Are you sure you want to delete this item?")) {
        db.collection(collectionName).doc(docId).delete().then(() => {
            alert("Deleted successfully!");
            logActivity("Deleted item from " + collectionName, auth.currentUser ? auth.currentUser.email : "Admin");
            if(collectionName === 'pending_notes') loadPendingNotesForReview();
            else loadManageContent();
        }).catch(err => alert("Error deleting: " + err.message));
    }
}

function loadManageUsers() {
    const container = document.getElementById("users-list-container");
    if (!container) return;
    container.innerHTML = "<p>Loading students...</p>";

    db.collection("users").get().then((snapshot) => {
        if (snapshot.empty) {
            container.innerHTML = "<p>No registered students found.</p>";
            return;
        }

        let html = `<table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr style="background: #f1f3f4; text-align: left;"><th style="padding: 8px;">Photo</th><th style="padding: 8px;">Name</th><th style="padding: 8px;">Email</th><th style="padding: 8px;">School</th><th style="padding: 8px;">Actions</th></tr>`;

        snapshot.forEach((doc) => {
            const user = doc.data();
            const photoUrl = user.photo || 'https://via.placeholder.com/30';
            html += `<tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 8px;"><img src="${photoUrl}" style="width:30px; height:30px; border-radius:50%; object-fit: cover;"></td>
                <td style="padding: 8px;">${user.name || 'N/A'}</td>
                <td style="padding: 8px;">${user.email || 'N/A'}</td>
                <td style="padding: 8px;">${user.school || 'N/A'}</td>
                <td style="padding: 8px; display: flex; gap: 5px;">
                    <a href="${photoUrl}" download="student_profile.jpg" target="_blank" style="background:#1a73e8; color:white; padding:5px 8px; border-radius:4px; text-decoration:none; font-size:11px; font-weight:bold;">Photo</a>
                    <button onclick="deleteUserRecord('${doc.id}')" style="background:#d93025; color:white; border:none; padding:5px 8px; border-radius:4px; cursor:pointer; font-size:11px;">Delete</button>
                </td>
            </tr>`;
        });

        html += `</table>`;
        container.innerHTML = html;
    }).catch(err => {
        container.innerHTML = "<p style='color:red;'>Error loading students.</p>";
    });
}

function deleteUserRecord(userId) {
    if (confirm("Delete this user?")) {
        db.collection("users").doc(userId).delete().then(() => loadManageUsers());
    }
}

function loadActivityLogs() {
    const container = document.getElementById("activity-log-container");
    if (!container) return;
    container.innerHTML = "<p>Loading logs...</p>";

    db.collection("activity_logs").orderBy("timestamp", "desc").limit(50).get().then((snapshot) => {
        if (snapshot.empty) {
            container.innerHTML = "<p>No activity recorded yet.</p>";
            return;
        }

        let html = `<table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr style="background: #f1f3f4; text-align: left;"><th style="padding: 8px;">Action / Event</th><th style="padding: 8px;">User Email</th><th style="padding: 8px;">Time</th></tr>`;

        snapshot.forEach((doc) => {
            const log = doc.data();
            const time = log.timestamp ? log.timestamp.toDate().toLocaleString() : 'Just now';
            html += `<tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 8px;"><b>${log.action}</b></td>
                <td style="padding: 8px; color: #1a73e8;">${log.userEmail}</td>
                <td style="padding: 8px; font-size: 11px; color: #666;">${time}</td>
            </tr>`;
        });

        html += `</table>`;
        container.innerHTML = html;
    }).catch(err => {
        container.innerHTML = "<p style='color:red;'>Error loading activity logs.</p>";
    });
}

function downloadBackup() {
    alert("Preparing backup data...");
    let backupData = {};
    Promise.all([
        db.collection("chapters").get().then(snap => backupData.chapters = snap.docs.map(d => ({ id: d.id, ...d.data() }))),
        db.collection("question_papers").get().then(snap => backupData.question_papers = snap.docs.map(d => ({ id: d.id, ...d.data() }))),
        db.collection("users").get().then(snap => backupData.users = snap.docs.map(d => ({ id: d.id, ...d.data() })))
    ]).then(() => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", "study_with_surojit_backup.json");
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        alert("Backup downloaded successfully!");
    }).catch(err => alert("Backup failed: " + err.message));
}

function restoreBackupData() {
    const fileInput = document.getElementById("backup-file-input");
    if (!fileInput.files.length) {
        alert("Please select a backup JSON file first!");
        return;
    }
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const backupData = JSON.parse(event.target.result);
            if (confirm("Restoring data will overwrite existing items. Continue?")) {
                alert("Restoring data... Please wait.");
                if (backupData.chapters) {
                    backupData.chapters.forEach(item => {
                        db.collection("chapters").add(item);
                    });
                }
                if (backupData.question_papers) {
                    backupData.question_papers.forEach(item => {
                        db.collection("question_papers").add(item);
                    });
                }
                alert("Data restored successfully!");
            }
        } catch (e) {
            alert("Invalid JSON backup file!");
        }
    };
    reader.readAsText(file);
}

function listenToNotice() {
    db.collection("settings").doc("notice").onSnapshot((doc) => {
        if (doc.exists && doc.data().text) document.getElementById("announcement-text").innerText = doc.data().text;
    });
}

function updateNotice() {
    const newNotice = document.getElementById("new-announcement").value.trim();
    if (!newNotice) {
        alert("Please enter notice text!");
        return;
    }
    db.collection("settings").doc("notice").set({ text: newNotice }).then(() => {
        alert("Notice updated successfully!");
        document.getElementById("new-announcement").value = "";
        logActivity("Updated Announcement Notice", auth.currentUser ? auth.currentUser.email : "Admin");
    });
}

function saveCustomCode() {
    const code = document.getElementById("admin-code-input").value;
    db.collection("settings").doc("custom_code").set({ code: code }).then(() => {
        alert("Custom code published successfully!");
        logActivity("Updated Custom Code", auth.currentUser ? auth.currentUser.email : "Admin");
    });
}

function listenToCustomCode() {
    db.collection("settings").doc("custom_code").onSnapshot((doc) => {
        if (doc.exists && doc.data().code) {
            const container = document.getElementById("custom-code-container");
            const inputField = document.getElementById("admin-code-input");
            if (container) container.innerHTML = doc.data().code;
            if (inputField && !inputField.value) inputField.value = doc.data().code;
        }
    });
}

function updateContactInfo() {
    const insta1 = document.getElementById("edit-insta-1").value.trim();
    db.collection("settings").doc("contact_info").set({ insta1: insta1 }, { merge: true }).then(() => {
        alert("Contact info updated successfully!");
        logActivity("Updated Contact Info", auth.currentUser ? auth.currentUser.email : "Admin");
    });
}

function listenToContactInfo() {
    db.collection("settings").doc("contact_info").onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            const i1 = data.insta1 || "sanatani_surojit";
            const el = document.getElementById("display-insta-1");
            if(el) {
                el.innerText = "@" + i1;
                el.href = "https://instagram.com/" + i1;
            }
            if(document.getElementById("edit-insta-1")) document.getElementById("edit-insta-1").value = i1;
        }
    });
}

function openSubject(subjectName) {
    currentSelectedSubject = subjectName;
    document.getElementById("selected-subject-title").innerText = subjectName + " Notes";
    document.getElementById("subjects-section").style.display = "none";
    const lbSec = document.getElementById("leaderboard-section");
    if(lbSec) lbSec.style.display = "none";
    document.getElementById("chapter-section").style.display = "block";
    loadChapters(subjectName);
    logActivity("Viewed Subject Notes: " + subjectName, auth.currentUser ? auth.currentUser.email : "Guest");
}

function showSubjects() {
    document.getElementById("admin-dashboard").style.display = "none";
    document.getElementById("chapter-section").style.display = "none";
    document.getElementById("papers-section").style.display = "none";
    document.getElementById("profile-section").style.display = "none";
    document.getElementById("settings-section").style.display = "none";
    document.getElementById("contact-section").style.display = "none";
    const lbSec = document.getElementById("leaderboard-section");
    if(lbSec) lbSec.style.display = "none";
    document.getElementById("subjects-section").style.display = "block";
}

function loadChapters(subjectName) {
    const container = document.getElementById("chapter-list");
    container.innerHTML = "<p>Loading notes...</p>";
    db.collection("chapters").where("subject", "==", subjectName).get().then((snapshot) => {
        container.innerHTML = "";
        if (snapshot.empty) {
            container.innerHTML = `<p>No content available.</p>`;
            return;
        }
        snapshot.forEach((doc) => {
            const data = doc.data();
            const card = document.createElement("div");
            card.style = "background: #fff; padding: 15px; margin-bottom: 12px; border-radius: 8px; border-left: 4px solid #1a73e8; box-shadow: 0 2px 4px rgba(0,0,0,0.05); display: flex; justify-content: space-between; align-items: center;";
            
            card.innerHTML = `<div>
                <h4 style="margin: 0; font-size: 15px;">${data.name}</h4>
                <span style="font-size: 11px; color: #666;">Subject: ${data.subject}</span>
            </div>
            <div style="display: flex; gap: 8px;">
                <a href="${data.pdfUrl}" target="_blank" onclick="logNoteAction('Viewed Note', '${data.name}')" style="background: #1a73e8; color: #fff; padding: 6px 12px; text-decoration: none; border-radius: 5px; font-size: 12px;">👁️ View</a>
                <a href="${data.pdfUrl}" download target="_blank" onclick="logNoteAction('Downloaded Note', '${data.name}')" style="background: #28a745; color: #fff; padding: 6px 12px; text-decoration: none; border-radius: 5px; font-size: 12px;">📥 Download</a>
            </div>`;
            container.appendChild(card);
        });
    });
}

function logNoteAction(actionType, noteTitle) {
    const user = auth.currentUser;
    logActivity(`${actionType}: ${noteTitle}`, user ? user.email : "Guest");
}

function addNewContent() {
    const subject = document.getElementById("admin-subject-select").value;
    const title = document.getElementById("chapter-name-input").value.trim();
    const link = document.getElementById("pdf-url-input").value.trim();

    if (!title || !link) {
        alert("Please enter title and PDF link!");
        return;
    }

    db.collection("chapters").add({
        subject: subject,
        name: title,
        pdfUrl: link,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        alert("Note saved successfully!");
        document.getElementById("chapter-name-input").value = "";
        document.getElementById("pdf-url-input").value = "";
        logActivity("Admin Uploaded Note: " + title, auth.currentUser ? auth.currentUser.email : "Admin");
    });
}

function addNewQuestionPaper() {
    const category = document.getElementById("admin-paper-category").value;
    const subject = document.getElementById("admin-paper-subject").value;
    const title = document.getElementById("admin-paper-title").value.trim();
    const url = document.getElementById("admin-paper-url").value.trim();

    if (!title || !url) {
        alert("Please fill in both paper title and PDF link!");
        return;
    }

    db.collection("question_papers").add({
        category: category,
        subject: subject,
        title: title,
        pdfUrl: url,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        alert("Question paper uploaded successfully!");
        document.getElementById("admin-paper-title").value = "";
        document.getElementById("admin-paper-url").value = "";
        logActivity("Admin Uploaded Question Paper: " + title, auth.currentUser ? auth.currentUser.email : "Admin");
    });
}

function showQuestionPapers() {
    document.getElementById("subjects-section").style.display = "none";
    document.getElementById("profile-section").style.display = "none";
    document.getElementById("admin-dashboard").style.display = "none";
    const lbSec = document.getElementById("leaderboard-section");
    if(lbSec) lbSec.style.display = "none";
    document.getElementById("papers-section").style.display = "block";
    loadQuestionPapers('all');
    logActivity("Viewed Question Papers Section", auth.currentUser ? auth.currentUser.email : "Guest");
}

function filterPapers(category, btnElement) {
    currentPaperFilter = category;
    document.querySelectorAll('.paper-tab-btn').forEach(btn => {
        btn.style.background = 'white';
        btn.style.color = '#1a73e8';
    });
    if (btnElement) {
        btnElement.style.background = '#1a73e8';
        btnElement.style.color = 'white';
    }
    loadQuestionPapers(category);
}

function loadQuestionPapers(category) {
    const container = document.getElementById("papers-list-container");
    container.innerHTML = "<p>Loading papers...</p>";

    let query = db.collection("question_papers");
    if (category !== 'all') query = query.where("category", "==", category);

    query.get().then((snapshot) => {
        container.innerHTML = "";
        if (snapshot.empty) {
            container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #666;">No question papers available.</p>`;
            return;
        }
        snapshot.forEach((doc) => {
            const paper = doc.data();
            const card = document.createElement("div");
            card.style = "background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #e0e0e0; box-shadow: 0 2px 4px rgba(0,0,0,0.05); display: flex; flex-direction: column; justify-content: space-between;";
            card.innerHTML = `<div>
                <span style="background: #e8f0fe; color: #1a73e8; padding: 2px 6px; border-radius: 4px; font-size: 11px;">${paper.category} - ${paper.subject}</span>
                <h4 style="margin: 8px 0 10px 0; font-size: 15px;">${paper.title}</h4>
            </div>
            <div style="display: flex; gap: 8px; margin-top: 10px;">
                <a href="${paper.pdfUrl}" target="_blank" onclick="logNoteAction('Viewed Paper', '${paper.title}')" style="background: #1a73e8; color: white; text-decoration: none; padding: 6px 12px; border-radius: 5px; font-size: 12px;">👁️ View</a>
                <a href="${paper.pdfUrl}" download target="_blank" onclick="logNoteAction('Downloaded Paper', '${paper.title}')" style="background: #28a745; color: white; text-decoration: none; padding: 6px 12px; border-radius: 5px; font-size: 12px;">📥 Download</a>
            </div>`;
            container.appendChild(card);
        });
    });
}

// --- LEADERBOARD FEATURE ---
function renderLeaderboardTabHTML() {
    let lbSec = document.getElementById("leaderboard-section");
    if (!lbSec) {
        lbSec = document.createElement("div");
        lbSec.id = "leaderboard-section";
        lbSec.style = "display: none; padding: 20px; max-width: 800px; margin: 20px auto;";
        lbSec.innerHTML = `
            <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.08);">
                <h2 style="color: #1a73e8; margin-top: 0;">🏆 Student Activity Leaderboard</h2>
                <p style="font-size: 13px; color: #666;">Rankings based on active study time spent on the portal.</p>
                <div id="leaderboard-list-container">
                    <p>Loading leaderboard...</p>
                </div>
            </div>
        `;
        document.body.appendChild(lbSec);
    }
}

function showLeaderboardSection() {
    document.getElementById("subjects-section").style.display = "none";
    document.getElementById("chapter-section").style.display = "none";
    document.getElementById("papers-section").style.display = "none";
    document.getElementById("profile-section").style.display = "none";
    document.getElementById("settings-section").style.display = "none";
    document.getElementById("contact-section").style.display = "none";
    document.getElementById("admin-dashboard").style.display = "none";
    
    const lbSec = document.getElementById("leaderboard-section");
    if(lbSec) lbSec.style.display = "block";
    closeSidebar();
    loadLeaderboardData();
    logActivity("Viewed Leaderboard", auth.currentUser ? auth.currentUser.email : "Guest");
}

function loadLeaderboardData() {
    const container = document.getElementById("leaderboard-list-container");
    if (!container) return;
    container.innerHTML = "<p>Loading leaderboard rankings...</p>";

    db.collection("users").orderBy("timeSpentSeconds", "desc").limit(20).get().then((snapshot) => {
        if (snapshot.empty) {
            container.innerHTML = "<p>No activity data available yet.</p>";
            return;
        }

        let html = `<table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr style="background: #f1f3f4; text-align: left;"><th style="padding: 10px;">Rank</th><th style="padding: 10px;">Student</th><th style="padding: 10px;">School</th><th style="padding: 10px;">Time Spent</th></tr>`;

        let rank = 1;
        snapshot.forEach((doc) => {
            const data = doc.data();
            const photo = data.photo || "https://via.placeholder.com/30";
            const seconds = data.timeSpentSeconds || 0;
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes} mins`;

            let badgeColor = "#555";
            if (rank === 1) badgeColor = "#d4af37"; // Gold
            else if (rank === 2) badgeColor = "#c0c0c0"; // Silver
            else if (rank === 3) badgeColor = "#cd7f32"; // Bronze

            html += `<tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px; font-weight: bold; color: ${badgeColor};">#${rank}</td>
                <td style="padding: 10px; display: flex; align-items: center; gap: 8px;">
                    <img src="${photo}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">
                    <span>${data.name || 'Student'}</span>
                </td>
                <td style="padding: 10px; color: #555;">${data.school || 'N/A'}</td>
                <td style="padding: 10px; font-weight: bold; color: #1a73e8;">${timeStr}</td>
            </tr>`;
            rank++;
        });

        html += `</table>`;
        container.innerHTML = html;
    }).catch(err => {
        container.innerHTML = "<p style='color:red;'>Error loading leaderboard data.</p>";
    });
}