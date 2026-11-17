import { PasswordField } from './PasswordField'
import { useEffect,useState,useSyncExternalStore } from 'react'
import { Text, View } from 'react-native'
import { Sheet } from './Sheet'
import { IconTextButton } from './AdminUi'
import { Icon } from './Icon'
import { useSession } from '../core/auth/Session'
import { errorMessage,onStepUpRequired } from '../core/api/client'
import { confirmPasskey,confirmPassword,passkeysSupported,isPasskeyCancel } from '../core/auth/security'
import { StepUpFlow } from '../core/auth/stepUpFlow'
import { Button,Label,radius,useColors } from '../ui'

/** Web StepUpDialog `WHY`, word for word. */
export const STEP_UP_WHY: Record<string,string> = {
 admin:'This is an administrator action.',
 security_settings:'You are changing how you sign in or which devices are signed in.',
 jp:'You are opening Passwords.',
 oversight:'You are starting oversight: every chat and vault you open is recorded. Use your passkey.',
}

export function StepUp(){const {me}=useSession();const [flow]=useState(()=>new StepUpFlow({supported:passkeysSupported,password:confirmPassword,passkey:confirmPasskey,message:errorMessage,cancelled:isPasskeyCancel}))
 useEffect(()=>{if(!me?.id)return;onStepUpRequired(flow.request);return()=>{onStepUpRequired(null);flow.clear()}},[flow,me?.id,me?.session?.id])
 return <StepUpPrompt flow={flow}/>
}

/**
 * "Confirm it's you" (web core/auth/StepUpDialog). Passkey first: when the server allows a passkey and this device
 * can use one, the fingerprint / face / PIN prompt opens by itself as the sheet appears (StepUpFlow starts it);
 * the password field shows only after the passkey is cancelled or fails, or when the person chooses
 * "Use your password instead". One sheet per action.
 */
export function StepUpPrompt({flow}:{flow:StepUpFlow}){
 const c=useColors();const state=useSyncExternalStore(flow.subscribe,flow.snapshot,flow.snapshot)
 const passkeyBusy=state.method==='passkey'&&state.busy
 const submit=()=>{if(!state.busy&&state.method==='password'&&state.secret)void flow.verify('password')}
 const why=STEP_UP_WHY[state.scope]
 return <Sheet bottomAligned label="Confirm it’s you" visible={state.active} onClose={flow.cancel}>
  <Label large>Confirm it’s you</Label>
  {!!why&&<Label>{why}</Label>}
  {!state.methods.length?<Label>This needs two-step verification. Add a passkey (fingerprint, face, or screen lock) in Profile &amp; security first.</Label>:<>
   {passkeyBusy&&<View accessibilityRole="text" accessibilityLiveRegion="polite" style={{flexDirection:'row',alignItems:'center',gap:8}}><Icon name="fingerprint" size={20} color={c.brand}/><Text style={{flex:1,color:c.text,fontSize:14,lineHeight:20}}>Confirm with your fingerprint, face or PIN…</Text></View>}
   {state.methods.includes('passkey')&&!passkeyBusy&&<IconTextButton icon="fingerprint" variant={state.method==='passkey'?'primary':'secondary'} title={state.method==='passkey'?'Use a passkey':'Try the passkey again'} disabled={state.busy} onPress={()=>void flow.verify('passkey')}/>}
   {state.methods.length>1&&state.methods.includes('password')&&<View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}><IconTextButton size="sm" icon="key" variant={state.method==='password'?'primary':'ghost'} title="Use your password instead" onPress={flow.usePassword}/></View>}
   {state.method==='password'&&<PasswordField label="Your password" autoComplete="current-password" textContentType="password" returnKeyType="go" autoFocus editable={!state.busy} onSubmitEditing={submit} value={state.secret} onChangeText={flow.setSecret}/>}
  </>}
  {!!state.error&&<Text accessibilityRole="alert" style={{color:c.danger,backgroundColor:c.dangerSoft,paddingHorizontal:12,paddingVertical:8,borderRadius:radius.control,fontSize:14,lineHeight:20}}>{state.error}</Text>}
  <View style={{flexDirection:'row',justifyContent:'flex-end',gap:8}}>
   <Button variant="secondary" title="Cancel" onPress={flow.cancel}/>
   {state.method==='password'&&<Button title="Confirm" accessibilityLabel="Verify password" loading={state.busy} disabled={state.busy||!state.secret} onPress={submit}/>}
  </View>
 </Sheet>
}
