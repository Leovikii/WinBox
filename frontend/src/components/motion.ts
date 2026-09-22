import { createPresenceComponent } from '@fluentui/react-components'

const entrance = 'cubic-bezier(0,0,0,1)'
const exit = 'cubic-bezier(1,0,1,1)'

export const PageMotion = createPresenceComponent({
  enter: { keyframes: [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'translateY(0)' }], duration: 250, easing: entrance },
  exit: { keyframes: [{ opacity: 1 }, { opacity: 0 }], duration: 83, easing: 'linear' },
})

// Official presence owns mounting and reduced motion. Height includes the gap so
// the next row follows the leaving row, instead of jumping after it is unmounted.
export const ExpandMotion = createPresenceComponent(({ element }) => {
  const height = element.scrollHeight
  return {
    enter: { keyframes: [{ height: '0px', opacity: 0 }, { height: `${height}px`, opacity: 1 }], duration: 250, easing: entrance, fill: 'none' },
    exit: { keyframes: [{ height: `${height}px`, opacity: 1 }, { height: '0px', opacity: 0 }], duration: 167, easing: exit },
  }
})
