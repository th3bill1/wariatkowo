import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../src/auth/AuthContext';
import { AppWordmark } from '../../src/components/app/AppWordmark';
import { ProfileAvatar } from '../../src/components/app/ProfileAvatar';

export function LoginPage(){
 const {member,members,isLoading,login}=useAuth();
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [pin,setPin]=useState('');
 const [error,setError]=useState<string|null>(null);
 const [submitting,setSubmitting]=useState(false);
 const navigate=useNavigate();
 const location=useLocation();
 const destination=(location.state as {from?:string}|null)?.from??'/dashboard';
 if(!isLoading&&member) return <Navigate replace to={destination}/>;
 const selected=members.find(item=>item.id===selectedId);
 const submit=async(event:FormEvent)=>{
  event.preventDefault();if(!selectedId||pin.length!==4)return;
  setSubmitting(true);setError(null);
  try{await login(selectedId,pin);navigate(destination,{replace:true});}
  catch(loginError){setError(loginError instanceof Error?loginError.message:'Nie udało się zalogować.');setPin('');}
  finally{setSubmitting(false);}
 };
 return <main className="login-page">
  <section className="login-card" aria-labelledby="login-title">
   <AppWordmark/>
   <div>
    <p className="page-header__eyebrow">Domowy dostęp</p>
    <h1 id="login-title">{selected?'Wpisz PIN':'Kto wrócił do Wariatkowa?'}</h1>
    <p className="login-card__description">{selected?'Cztery cyfry i jesteśmy w domu.':'Wybierz swój profil.'}</p>
   </div>
   {!selected?<div className="profile-picker">
    {members.map(item=><button className="profile-choice" key={item.id} onClick={()=>setSelectedId(item.id)} type="button">
      <ProfileAvatar member={item}/><span>{item.name}</span>
    </button>)}
   </div>:<form className="pin-form" onSubmit={submit}>
    <div className="pin-form__member"><ProfileAvatar member={selected}/><strong>{selected.name}</strong></div>
    <label className="field"><span className="field__label">PIN</span><input autoFocus className="field__input pin-input" inputMode="numeric" maxLength={4} pattern="\d{4}" required type="password" value={pin} onChange={event=>setPin(event.target.value.replace(/\D/g,'').slice(0,4))}/></label>
    {error?<p className="form-message form-message--error" role="alert">{error}</p>:null}
    <div className="task-form__actions"><button className="primary-button" disabled={submitting||pin.length!==4} type="submit">{submitting?'Sprawdzamy…':'Wejdź'}</button><button className="secondary-button" disabled={submitting} onClick={()=>{setSelectedId(null);setPin('');setError(null);}} type="button">Zmień profil</button></div>
   </form>}
  </section>
 </main>;
}
