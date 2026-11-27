import { supabase } from '../supabaseClient'

export interface Office {
  id: number
  code: string
  name: string
  hotline: string | null
  contact_info: string | null
}

export async function fetchOffices(): Promise<Office[]> {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase
    .from('offices')
    .select('id, code, name, hotline, contact_info')
    .eq('is_active', true)
    .order('name')
  if (error) throw new Error(error.message)
  return data as Office[]
}

/** Turns "(043) 000-0001" into "tel:0430000001" for one-tap calling. */
export function telHref(hotline: string): string {
  return `tel:${hotline.replace(/[^\d+]/g, '')}`
}
