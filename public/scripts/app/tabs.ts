'use sanity'

import { Subscribe, Publish } from './pubsub'

export class Tabs {
  protected static tabs: HTMLElement[] = []
  protected static tabNames: string[] = []

  public static Init (): void {
    this.tabs = Array.from(document.querySelectorAll<HTMLElement>('.tab-list a'))
    this.tabNames = this.tabs.map(tab => tab.getAttribute('href'))
      .filter(name => name !== null) as string[]

    for (const tab of this.tabs) {
      tab.parentElement?.addEventListener('click', evt => {
        this.SelectTab(tab.getAttribute('href') ?? '')
        evt.preventDefault()
        return false
      })
    }

    Subscribe('Tab:Select', (name) => { this.SelectTab(`${name}`) })
    this.SelectTab()
  }

  static SelectTab (href?: string): void {
    if (href != null && href[0] !== '#') {
      href = `#tab${href}`
    }
    const lowerHref = href?.toLowerCase()
    if (href == null || !this.tabNames.some(name => name.toLowerCase() === lowerHref)) {
      href = this.tabNames[0] ?? ''
    }
    for (const tab of this.tabs) {
      const tabHref = tab.getAttribute('href')
      if (tabHref === null) {
        tab.parentElement?.classList.remove('active')
        continue
      }
      const content = document.querySelector<HTMLElement>(tabHref)
      if (tabHref.toLowerCase() === lowerHref) {
        href = tabHref
        tab.parentElement?.classList.add('active')
        content?.style.setProperty('display', 'block')
        content?.scroll({
          top: 0,
          behavior: 'smooth'
        })
      } else {
        tab.parentElement?.classList.remove('active')
        content?.style.setProperty('display', 'none')
      }
    }
    Publish('Tab:Selected', href)
  }
}
