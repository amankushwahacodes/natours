import axios from 'axios'
import { showAlert } from './alerts';
export const login = async (email, pwd) => {
    // console.log('Login');
    try {
        const res = await axios({
            method: 'POST',
            url: 'https://natours-5fkg.onrender.com/api/v1/users/login',
            data: {
                email,
                pwd
            }
        })

        if(res.data.status === 'success'){
            showAlert('success','Logged in successfully',)
            window.setTimeout(()=>{
                location.assign('https://natours-5fkg.onrender.com/')                
            },1500)
        }
        // console.log(res);
    }
    catch(err){
        showAlert('error',err.response.data.message)
    }
}

export const logout = async () =>{
    try{
        const res = await axios({
            method : 'GET',
            url: '/api/v1/users/logout',
        })
        if(res.data.status === 'success') location.reload(true)
    }
    catch(err){
        showAlert('error','Error logging out ! Try again')
    }
}

