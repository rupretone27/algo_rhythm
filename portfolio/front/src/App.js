import { useEffect, useState } from "react";

function App()
{
  const [username, setUsername] = useState("");

  useEffect(() =>
  {
    fetch("/api/user").then((response) =>
        {
          if (response.ok)
          {
            return response.json();
          }
          throw new Error("로그인 되지 않음");
        })
        .then((data) => setUsername(data.name))
        .catch(() => {});
  }, []);

  const handleLogin = () =>
  {
    window.location.href = "/login/google";
  };

  const handleLogout = () =>
  {
      window.location.href = "/logout";
  };

  return(
      <div style={{ textAlign: "center", marginTop: "100px" }}>
          <h1>메인 화면</h1>
          {username ?
              (
                  <>
                      <h2>{username}님 환영합니다.</h2>
                      <button onClick={handleLogout}>로그아웃</button>
                  </>
              )
              : (<button onClick={handleLogin}>구글로 로그인</button>)}
      </div>
  );
}

export default App;